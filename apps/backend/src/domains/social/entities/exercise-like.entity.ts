/**
 * Exercise Like Entity
 *
 * Represents a public like on an exercise.
 * Likes are visible to everyone and contribute to the like_count.
 */

export interface ExerciseLikeProps {
  id: string;
  exerciseId: string;
  userId: string;
  createdAt: Date;
}

export class ExerciseLike {
  private constructor(private readonly props: ExerciseLikeProps) {}

  /**
   * Create a new like (for insertion)
   */
  static create(exerciseId: string, userId: string): ExerciseLike {
    return new ExerciseLike({
      id: crypto.randomUUID(),
      exerciseId,
      userId,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstitute from database record
   */
  static fromPersistence(record: {
    id: string;
    exercise_id: string;
    user_id: string;
    created_at: string;
  }): ExerciseLike {
    return new ExerciseLike({
      id: record.id,
      exerciseId: record.exercise_id,
      userId: record.user_id,
      createdAt: new Date(record.created_at),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get exerciseId(): string {
    return this.props.exerciseId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Convert to database format
   */
  toPersistence(): {
    id: string;
    exercise_id: string;
    user_id: string;
    created_at: string;
  } {
    return {
      id: this.props.id,
      exercise_id: this.props.exerciseId,
      user_id: this.props.userId,
      created_at: this.props.createdAt.toISOString(),
    };
  }
}
