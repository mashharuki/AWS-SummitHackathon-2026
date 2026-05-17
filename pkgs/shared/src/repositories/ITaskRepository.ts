import type { Task } from "../types";

/** Return type for approve() */
export type ApprovedTask = Task;

/**
 * Task repository interface
 *
 * Access patterns:
 * - Query GSI-UserStatus userId=USER#<userId> status=approved
 * - GetItem PK=USER#<userId> SK=TASK#<taskId>
 * - PutItem — Manual add / approval
 * - UpdateItem — Inline edit / logical delete
 * - TransactWriteItems Put — Atomic operation on candidate approval
 */
export interface ITaskRepository {
  /**
   * Get approved task list
   * DynamoDB: Query GSI-UserStatus userId=USER#<userId> status=approved
   * Access pattern: GET /api/tasks (approved)
   */
  findApprovedByUserId(userId: string): Promise<Task[]>;

  /**
   * Get single task
   * DynamoDB: GetItem PK=USER#<userId> SK=TASK#<taskId>
   * Access pattern: GET /api/tasks/:id
   */
  findById(userId: string, taskId: string): Promise<Task | null>;

  /**
   * Manually create task (immediately approved with status=approved)
   * DynamoDB: PutItem PK=USER#<userId> SK=TASK#<ulid>
   * ULID generated with generateUlid() (BR-04)
   * Access pattern: POST /api/tasks
   */
  create(
    task: Omit<
      Task,
      "PK" | "SK" | "taskId" | "status" | "approvedAt" | "updatedAt"
    >,
  ): Promise<Task>;

  /**
   * Update task (inline edit)
   * DynamoDB: UpdateItem PK=USER#<userId> SK=TASK#<taskId>
   * updatedAt automatically updated
   * Access pattern: PATCH /api/tasks/:id
   */
  update(
    userId: string,
    taskId: string,
    updates: Partial<Pick<Task, "title" | "deadline" | "description">>,
  ): Promise<Task>;

  /**
   * Logical delete task (change status=deleted, no physical delete, BR-03)
   * DynamoDB: UpdateItem PK=USER#<userId> SK=TASK#<taskId>
   * Access pattern: DELETE /api/tasks/:id
   */
  softDelete(userId: string, taskId: string): Promise<void>;

  /**
   * Called internally from TaskCandidateRepository.approve()
   * Wraps Put operation of TransactWriteItems
   * (Used via ITaskCandidateRepository)
   * Direct calls prohibited (bypasses candidate approval flow)
   */
  putFromTransaction(task: Task): Promise<void>;
}
