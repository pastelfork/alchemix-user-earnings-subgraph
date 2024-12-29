import { onchainTable, primaryKey, relations } from "ponder";

export const yieldTokens = onchainTable("yield_token", (t) => ({
  yieldToken: t.hex().primaryKey(),
  network: t.text().notNull(),
}));

export const yieldTokensRelations = relations(yieldTokens, ({ many }) => ({
  depositors: many(depositors),
}));

export const depositors = onchainTable(
  "depositor",
  (t) => ({
    depositor: t.hex().notNull(),
    depositedYieldToken: t.hex().notNull(),
    network: t.text().notNull(),
    yieldTokenAmount: t.bigint().notNull(),
    totalUnderlyingTokenEarned: t.real().default(0),
    totalDonationsReceived: t.real().default(0),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.depositor, table.depositedYieldToken, table.network],
    }),
  })
);

export const depositorsRelations = relations(depositors, ({ one }) => ({
  yieldToken: one(yieldTokens, {
    fields: [depositors.depositedYieldToken, depositors.network],
    references: [yieldTokens.yieldToken, yieldTokens.network],
  }),
}));

export const harvestEvent = onchainTable("harvest_event", (t) => ({
  id: t.text().primaryKey(),
  blockNumber: t.bigint().notNull(),
  yieldToken: t.hex().notNull(),
  totalHarvested: t.bigint().notNull(),
  credit: t.bigint().notNull(),
  network: t.text().notNull(),
}));

export const userHarvestShares = onchainTable("user_harvest_share", (t) => ({
  id: t.text().primaryKey(),
  depositor: t.hex().notNull(),
  yieldToken: t.hex().notNull(),
  harvestId: t.text().notNull(),
  shares: t.bigint().notNull(),
  totalAlchemistShares: t.bigint().notNull(),
  userEarnings: t.real().notNull(),
  blockNumber: t.bigint().notNull(),
  network: t.text().notNull(),
}));

export const userHarvestSharesRelations = relations(
  userHarvestShares,
  ({ one }) => ({
    depositorEntity: one(depositors, {
      fields: [userHarvestShares.depositor, userHarvestShares.network],
      references: [depositors.depositor, depositors.network],
    }),
    yieldTokenEntity: one(yieldTokens, {
      fields: [userHarvestShares.yieldToken, userHarvestShares.network],
      references: [yieldTokens.yieldToken, yieldTokens.network],
    }),
    harvestEventEntity: one(harvestEvent, {
      fields: [userHarvestShares.harvestId, userHarvestShares.network],
      references: [harvestEvent.id, harvestEvent.network],
    }),
  })
);

export const donateEvent = onchainTable("donate_event", (t) => ({
  id: t.text().primaryKey(),
  blockNumber: t.bigint().notNull(),
  yieldToken: t.hex().notNull(),
  debtTokensBurned: t.bigint().notNull(),
  network: t.text().notNull(),
}));

export const userDonateShares = onchainTable("user_donate_share", (t) => ({
  id: t.text().primaryKey(),
  depositor: t.hex().notNull(),
  yieldToken: t.hex().notNull(),
  donateId: t.text().notNull(),
  shares: t.bigint().notNull(),
  totalAlchemistShares: t.bigint().notNull(),
  donationReceived: t.real().notNull(),
  blockNumber: t.bigint().notNull(),
  network: t.text().notNull(),
}));

export const userDonateSharesRelations = relations(
  userDonateShares,
  ({ one }) => ({
    depositorEntity: one(depositors, {
      fields: [userDonateShares.depositor, userDonateShares.network],
      references: [depositors.depositor, depositors.network],
    }),
    yieldTokenEntity: one(yieldTokens, {
      fields: [userDonateShares.yieldToken, userDonateShares.network],
      references: [yieldTokens.yieldToken, yieldTokens.network],
    }),
    donateEventEntity: one(donateEvent, {
      fields: [userDonateShares.donateId, userDonateShares.network],
      references: [donateEvent.id, donateEvent.network],
    }),
  })
);
