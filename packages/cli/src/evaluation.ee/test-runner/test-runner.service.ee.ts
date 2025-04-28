import { Service } from '@n8n/di';
import { ErrorReporter, Logger } from 'n8n-core';
import { ExecutionCancelledError } from 'n8n-workflow';
import type {
	IDataObject,
	IRun,
	IWorkflowBase,
	IWorkflowExecutionDataProcess,
	IExecuteData,
	INodeExecutionData,
} from 'n8n-workflow';
import assert from 'node:assert';

import { ActiveExecutions } from '@/active-executions';
import config from '@/config';
import { EVALUATION_DATASET_TRIGGER_NODE, EVALUATION_METRICS_NODE } from '@/constants';
import type { TestRun } from '@/databases/entities/test-run.ee';
import type { User } from '@/databases/entities/user';
import { TestCaseExecutionRepository } from '@/databases/repositories/test-case-execution.repository.ee';
import { TestRunRepository } from '@/databases/repositories/test-run.repository.ee';
import { WorkflowRepository } from '@/databases/repositories/workflow.repository';
import * as Db from '@/db';
import { TestCaseExecutionError, TestRunError } from '@/evaluation.ee/test-runner/errors.ee';
import { Telemetry } from '@/telemetry';
import { WorkflowRunner } from '@/workflow-runner';

import { EvaluationMetrics } from './evaluation-metrics.ee';

export interface TestRunMetadata {
	testRunId: string;
	userId: string;
}

export interface TestCaseExecutionResult {
	executionData: IRun;
	executionId: string;
}

/**
 * TODO: update description
 * This service orchestrates the running of test cases.
 * It uses the test definitions to find
 * past executions, creates pin data from them,
 * and runs the workflow-under-test with the pin data.
 * After the workflow-under-test finishes, it runs the evaluation workflow
 * with the original and new run data, and collects the metrics.
 */
@Service()
export class TestRunnerService {
	private abortControllers: Map<TestRun['id'], AbortController> = new Map();

	constructor(
		private readonly logger: Logger,
		private readonly telemetry: Telemetry,
		private readonly workflowRepository: WorkflowRepository,
		private readonly workflowRunner: WorkflowRunner,
		private readonly activeExecutions: ActiveExecutions,
		private readonly testRunRepository: TestRunRepository,
		private readonly testCaseExecutionRepository: TestCaseExecutionRepository,
		private readonly errorReporter: ErrorReporter,
	) {}

	/**
	 * Finds the dataset trigger node in the workflow
	 */
	private findTriggerNode(workflow: IWorkflowBase) {
		const triggerNode = workflow.nodes.find(
			(node) => node.type === EVALUATION_DATASET_TRIGGER_NODE,
		);

		if (!triggerNode) {
			// TODO: Change error
			throw new TestCaseExecutionError('TRIGGER_NO_LONGER_EXISTS');
		}

		return triggerNode;
	}

	/**
	 * Prepares the start nodes and trigger node data props for the `workflowRunner.run` method input.
	 */
	private getStartNodesData(
		workflow: IWorkflowBase,
	): Pick<IWorkflowExecutionDataProcess, 'triggerToStartFrom'> {
		const triggerNode = this.findTriggerNode(workflow);

		return {
			triggerToStartFrom: {
				name: triggerNode.name,
			},
		};
	}

	/**
	 * Runs a test case with the given input
	 * Waits for the workflow under test to finish execution.
	 */
	private async runTestCase(
		workflow: IWorkflowBase,
		metadata: TestRunMetadata,
		testCase: INodeExecutionData,
		abortSignal: AbortSignal,
	): Promise<TestCaseExecutionResult | undefined> {
		// Do not run if the test run is cancelled
		if (abortSignal.aborted) {
			return;
		}

		// Create pin data from the past execution data
		// const pinData = createPinData(
		// 	workflow,
		// 	mockedNodes,
		// 	pastExecutionData,
		// 	pastExecutionWorkflowData,
		// );

		const startNodesData = this.getStartNodesData(workflow);

		// Prepare the data to run the workflow
		// Evaluation executions should run the same way as manual,
		// because they need pinned data and partial execution logic

		const triggerNode = this.findTriggerNode(workflow);

		const pinData = {
			[triggerNode.name]: [testCase],
		};

		// Initialize the input data for dataset trigger
		const nodeExecutionStack: IExecuteData[] = [];
		nodeExecutionStack.push({
			// node: startNodesData.triggerToStartFrom.name as INode,
			node: triggerNode,
			data: {
				main: [[{ json: { test: 123 } }]],
			},
			source: null,
		});

		const data: IWorkflowExecutionDataProcess = {
			...startNodesData,
			executionMode: 'evaluation',
			runData: {},
			pinData,
			workflowData: workflow,
			userId: metadata.userId,
			partialExecutionVersion: 2,
			executionData: {
				startData: {
					// startNodes: startNodesData.startNodes,
				},
				resultData: {
					// pinData,
					runData: {},
				},
				executionData: {
					contextData: {},
					metadata: {},
					nodeExecutionStack,
					waitingExecution: {},
					waitingExecutionSource: {},
				},
				manualData: {
					userId: metadata.userId,
					partialExecutionVersion: 2,
					triggerToStartFrom: startNodesData.triggerToStartFrom,
				},
			},
		};

		// When in queue mode, we need to pass additional data to the execution
		// the same way as it would be passed in manual mode
		if (config.getEnv('executions.mode') === 'queue') {
			data.executionData = {
				startData: {
					// startNodes: startNodesData.startNodes,
				},
				resultData: {
					// pinData,
					runData: {},
				},
				manualData: {
					userId: metadata.userId,
					partialExecutionVersion: 2,
					triggerToStartFrom: startNodesData.triggerToStartFrom,
				},
			};
		}

		// Trigger the workflow under test with mocked data
		const executionId = await this.workflowRunner.run(data);
		assert(executionId);

		// Listen to the abort signal to stop the execution in case test run is cancelled
		abortSignal.addEventListener('abort', () => {
			this.activeExecutions.stopExecution(executionId);
		});

		// Wait for the execution to finish
		const executionData = await this.activeExecutions.getPostExecutePromise(executionId);

		assert(executionData);

		return { executionId, executionData };
	}

	/**
	 * This method creates a partial workflow execution to run the dataset trigger only
	 * to get the whole dataset.
	 */
	private async runDatasetTrigger(workflow: IWorkflowBase, metadata: TestRunMetadata) {
		const startNodesData = this.getStartNodesData(workflow);

		// Prepare the data to run the workflow
		// Evaluation executions should run the same way as manual,
		// because they need pinned data and partial execution logic

		const triggerNode = this.findTriggerNode(workflow);

		// Initialize the input data for dataset trigger
		// Provide a flag indicating that we want to get the whole dataset
		const nodeExecutionStack: IExecuteData[] = [];
		nodeExecutionStack.push({
			node: triggerNode,
			data: {
				main: [[{ json: { requestDataset: true } }]],
			},
			source: null,
		});

		// TODO: ideally we do not want this execution to appear in the executions list
		const data: IWorkflowExecutionDataProcess = {
			...startNodesData,
			destinationNode: triggerNode.name,
			executionMode: 'manual',
			runData: {},
			workflowData: workflow,
			userId: metadata.userId,
			partialExecutionVersion: 2,
			executionData: {
				startData: {
					destinationNode: triggerNode.name,
				},
				resultData: {
					runData: {},
				},
				executionData: {
					contextData: {},
					metadata: {},
					nodeExecutionStack,
					waitingExecution: {},
					waitingExecutionSource: {},
				},
				manualData: {
					userId: metadata.userId,
					partialExecutionVersion: 2,
					triggerToStartFrom: startNodesData.triggerToStartFrom,
				},
			},
		};

		// Trigger the workflow under test with mocked data
		const executionId = await this.workflowRunner.run(data);
		assert(executionId);

		// Wait for the execution to finish
		const executePromise = this.activeExecutions.getPostExecutePromise(executionId);

		return await executePromise;
	}

	/**
	 * Get the evaluation metrics nodes from a workflow.
	 */
	static getEvaluationMetricsNodes(workflow: IWorkflowBase) {
		return workflow.nodes.filter((node) => node.type === EVALUATION_METRICS_NODE);
	}

	/**
	 * Extract the dataset trigger output
	 */
	private extractDatasetTriggerOutput(execution: IRun, workflow: IWorkflowBase) {
		const triggerNode = this.findTriggerNode(workflow);

		const triggerOutput = execution.data.resultData.runData[triggerNode.name][0];
		if (!triggerOutput) {
			// TODO: Change error
			throw new TestRunError('UNKNOWN_ERROR');
		}

		return triggerOutput.data?.main?.[0];
	}

	/**
	 * Evaluation result is collected from all Evaluation Metrics nodes
	 */
	private extractEvaluationResult(execution: IRun, workflow: IWorkflowBase): IDataObject {
		const metricsNodes = TestRunnerService.getEvaluationMetricsNodes(workflow);
		const metricsRunData = metricsNodes.flatMap(
			(node) => execution.data.resultData.runData[node.name],
		);
		const metricsData = metricsRunData.reverse().map((data) => data.data?.main?.[0]?.[0]?.json);
		const metricsResult = metricsData.reduce((acc, curr) => ({ ...acc, ...curr }), {}) ?? {};

		return metricsResult;
	}

	/**
	 * Creates a new test run for the given workflow
	 */
	async runTest(user: User, workflowId: string): Promise<void> {
		this.logger.debug('Starting new test run', { workflowId });

		const workflow = await this.workflowRepository.findById(workflowId);
		assert(workflow, 'Workflow not found');

		// 0. Create new Test Run
		const testRun = await this.testRunRepository.createTestRun(workflowId);
		assert(testRun, 'Unable to create a test run');

		// 0.1 Initialize AbortController
		const abortController = new AbortController();
		this.abortControllers.set(testRun.id, abortController);

		// 0.2 Initialize metadata
		// This will be passed to the test case executions
		const testRunMetadata = {
			testRunId: testRun.id,
			userId: user.id,
		};

		let testRunEndStatusForTelemetry;

		const abortSignal = abortController.signal;
		try {
			///
			// 1. Make test cases list
			///

			const datasetFetchExecution = await this.runDatasetTrigger(workflow, testRunMetadata);
			assert(datasetFetchExecution);

			const datasetTriggerOutput = this.extractDatasetTriggerOutput(
				datasetFetchExecution,
				workflow,
			);
			assert(datasetTriggerOutput);

			const testCases = datasetTriggerOutput.map((items) => ({ json: items.json }));

			this.logger.debug('Found test cases', { count: testCases.length });

			if (testCases.length === 0) {
				// TODO: Change error
				throw new TestRunError('PAST_EXECUTIONS_NOT_FOUND');
			}

			// Add all past executions mappings to the test run.
			// This will be used to track the status of each test case and keep the connection between test run and all related executions (past, current, and evaluation).
			// await this.testCaseExecutionRepository.createBatch(
			// 	testRun.id,
			// 	testCases.map((e) => e.id),
			// );

			// 2. Run over all the test cases

			// Update test run status
			await this.testRunRepository.markAsRunning(testRun.id);

			this.telemetry.track('User ran test', {
				user_id: user.id,
				run_id: testRun.id,
				workflow_id: workflowId,
			});

			// Initialize object to collect the results of the evaluation workflow executions
			const metrics = new EvaluationMetrics();

			///
			// 2. Run over all the test cases
			///

			for (const testCase of testCases) {
				if (abortSignal.aborted) {
					this.logger.debug('Test run was cancelled', {
						workflowId,
					});
					break;
				}

				this.logger.debug('Running test case');

				try {
					const testCaseMetadata = {
						...testRunMetadata,
					};

					// Run the test case and wait for it to finish
					const testCaseResult = await this.runTestCase(
						workflow,
						testCaseMetadata,
						testCase,
						abortSignal,
					);
					assert(testCaseResult);

					const { executionId: testCaseExecutionId, executionData: testCaseExecution } =
						testCaseResult;

					assert(testCaseExecution);
					assert(testCaseExecutionId);

					this.logger.debug('Test case execution finished');

					const { addedMetrics } = metrics.addResults(
						this.extractEvaluationResult(testCaseExecution, workflow),
					);

					this.logger.debug('Test case metrics extracted', addedMetrics);

					// In case of a permission check issue, the test case execution will be undefined.
					// If that happens, or if the test case execution produced an error, mark the test case as failed.
					if (!testCaseExecution || testCaseExecution.data.resultData.error) {
						// Save the failed test case execution in DB
						await this.testCaseExecutionRepository.createTestCaseExecution({
							executionId: testCaseExecutionId,
							testRun: {
								id: testRun.id,
							},
							status: 'error',
							errorCode: 'FAILED_TO_EXECUTE_WORKFLOW',
							metrics: {},
						});
						continue;
					}

					// Create a new test case execution in DB
					await this.testCaseExecutionRepository.createTestCaseExecution({
						executionId: testCaseExecutionId,
						testRun: {
							id: testRun.id,
						},
						status: 'success',
						metrics: addedMetrics,
					});
				} catch (e) {
					// FIXME: this is a temporary log
					this.logger.error('Test case execution failed', {
						workflowId,
						testRunId: testRun.id,
						error: e,
					});

					// In case of an unexpected error save it as failed test case execution and continue with the next test case
					if (e instanceof TestCaseExecutionError) {
						await this.testCaseExecutionRepository.createTestCaseExecution({
							testRun: {
								id: testRun.id,
							},
							status: 'error',
							errorCode: e.code,
							errorDetails: e.extra as IDataObject,
						});
					} else {
						await this.testCaseExecutionRepository.createTestCaseExecution({
							testRun: {
								id: testRun.id,
							},
							status: 'error',
							errorCode: 'UNKNOWN_ERROR',
						});

						// Report unexpected errors
						this.errorReporter.error(e);
					}
				}
			}

			// Mark the test run as completed or cancelled
			if (abortSignal.aborted) {
				await Db.transaction(async (trx) => {
					await this.testRunRepository.markAsCancelled(testRun.id, trx);
					await this.testCaseExecutionRepository.markAllPendingAsCancelled(testRun.id, trx);

					testRunEndStatusForTelemetry = 'cancelled';
				});
			} else {
				const aggregatedMetrics = metrics.getAggregatedMetrics();

				this.logger.debug('Aggregated metrics', aggregatedMetrics);

				await this.testRunRepository.markAsCompleted(testRun.id, aggregatedMetrics);

				this.logger.debug('Test run finished', { workflowId, testRunId: testRun.id });

				testRunEndStatusForTelemetry = 'completed';
			}
		} catch (e) {
			if (e instanceof ExecutionCancelledError) {
				this.logger.debug('Evaluation execution was cancelled. Cancelling test run', {
					testRunId: testRun.id,
					stoppedOn: e.extra?.executionId,
				});

				await Db.transaction(async (trx) => {
					await this.testRunRepository.markAsCancelled(testRun.id, trx);
					await this.testCaseExecutionRepository.markAllPendingAsCancelled(testRun.id, trx);
				});

				testRunEndStatusForTelemetry = 'cancelled';
			} else if (e instanceof TestRunError) {
				await this.testRunRepository.markAsError(testRun.id, e.code, e.extra as IDataObject);
				testRunEndStatusForTelemetry = 'error';
			} else {
				await this.testRunRepository.markAsError(testRun.id, 'UNKNOWN_ERROR');
				testRunEndStatusForTelemetry = 'error';
				throw e;
			}
		} finally {
			// Clean up abort controller
			this.abortControllers.delete(testRun.id);

			// Send telemetry event
			this.telemetry.track('Test run finished', {
				workflow_id: workflowId,
				run_id: testRun.id,
				status: testRunEndStatusForTelemetry,
			});
		}
	}

	/**
	 * Checks if the test run in a cancellable state.
	 */
	canBeCancelled(testRun: TestRun) {
		return testRun.status !== 'running' && testRun.status !== 'new';
	}

	/**
	 * Cancels the test run with the given ID.
	 * TODO: Implement the cancellation of the test run in a multi-main scenario
	 */
	async cancelTestRun(testRunId: string) {
		const abortController = this.abortControllers.get(testRunId);
		if (abortController) {
			abortController.abort();
			this.abortControllers.delete(testRunId);
		} else {
			// If there is no abort controller - just mark the test run and all its' pending test case executions as cancelled
			await Db.transaction(async (trx) => {
				await this.testRunRepository.markAsCancelled(testRunId, trx);
				await this.testCaseExecutionRepository.markAllPendingAsCancelled(testRunId, trx);
			});
		}
	}
}
