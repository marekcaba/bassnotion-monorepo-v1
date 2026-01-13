/**
 * Exercise Favorite Entity
 *
 * Represents a private favorite on an exercise.
 * Favorites are only visible to the owning user.
 */

export interface ExerciseFavoriteProps {
  id: string;
  exerciseId: string;
  userId: string;
  createdAt: Date;
}

export class ExerciseFavorite {
  private constructor(private readonly props: ExerciseFavoriteProps) {}

  /**
   * Create a new favorite (for insertion)
   */
  static create(exerciseId: string, userId: string): ExerciseFavorite {
    return new ExerciseFavorite({
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
  }): ExerciseFavorite {
    return new ExerciseFavorite({
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
