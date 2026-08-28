import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const gameState = sqliteTable('game_state', {
  id: integer('id').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
