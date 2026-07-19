import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const kiosks = sqliteTable("kiosks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  ip: text("ip").notNull(),
  status: text("status").notNull().default("Online"),
  paper: integer("paper").notNull().default(100),
  toner: integer("toner").notNull().default(100),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  file: text("file").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("Pending"),
  time: text("time").notNull(),
  color: text("color").notNull().default("bw"),
  sides: text("sides").notNull().default("single"),
  copies: integer("copies").notNull().default(1),
  pages: integer("pages").notNull().default(1),
  range: text("range").notNull().default("All pages"),
  kioskId: text("kiosk_id").references(() => kiosks.id),
});
