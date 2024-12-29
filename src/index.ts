/**
 * Alchemix User Earnings Subgraph
 *
 * This module processes and indexes events from the AlchemistV2 contract,
 * tracking user deposits, harvests, and donations across different networks.
 *
 * Key Features:
 * - Tracks yield token additions
 * - Indexes user deposits
 * - Calculates user earnings during harvest events
 * - Records donation shares
 *
 * @module AlchemixUserEarningsSubgraph
 * @requires ponder
 * @requires uuid
 */

import { and, eq } from "ponder";
import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { v4 as uuidv4 } from "uuid";

/**
 * Represents a contract call for multicall operations
 * @typedef {Object} ContractCall
 * @property {string} address - Contract address
 * @property {any[]} abi - Contract ABI
 * @property {string} functionName - Name of the contract function to call
 * @property {(string | number)[]} args - Arguments for the contract function
 */
type ContractCall = {
  address: string;
  abi: any[];
  functionName: string;
  args: (string | number)[];
};

/**
 * Prepares contract calls for fetching positions of multiple depositors
 *
 * @param {any} context - Ponder context containing contract information
 * @param {any} event - The triggering blockchain event
 * @param {string[]} depositors - List of depositor addresses
 * @param {string} yieldToken - Address of the yield token
 * @returns {ContractCall[]} Array of contract calls for multicall
 */
const preparePositionCalls = (
  context: any,
  event: any,
  depositors: string[],
  yieldToken: string
): ContractCall[] => {
  return depositors.map((depositor) => ({
    address: event.log.address,
    abi: context.contracts.AlchemistV2.abi,
    functionName: "positions",
    args: [depositor, yieldToken],
  }));
};

// Event Handlers for AlchemistV2 Contract

/**
 * Handles the AddYieldToken event
 * Inserts new yield token information into the database
 */
ponder.on("AlchemistV2:AddYieldToken", async ({ event, context }) => {
  await context.db
    .insert(schema.yieldTokens)
    .values({
      yieldToken: event.args.yieldToken,
      network: context.network.name,
    })
    .onConflictDoNothing();
});

/**
 * Handles the Deposit event
 * Tracks user deposits of yield tokens
 * Inserts or updates depositor information in the database
 */
ponder.on("AlchemistV2:Deposit", async ({ event, context }) => {
  await context.db
    .insert(schema.depositors)
    .values({
      depositor: event.args.sender,
      depositedYieldToken: event.args.yieldToken,
      yieldTokenAmount: event.args.amount,
      network: context.network.name,
    })
    .onConflictDoUpdate((row) => ({
      yieldTokenAmount: row.yieldTokenAmount + event.args.amount,
    }));
});

/**
 * Handles the Harvest event
 * Calculates and records user earnings during harvest
 *
 * Key steps:
 * 1. Insert harvest event details
 * 2. Fetch all depositors for the yield token
 * 3. Retrieve yield token parameters
 * 4. Calculate protocol fee
 * 5. Use multicall to fetch user positions
 * 6. Calculate and record user earnings
 */
ponder.on("AlchemistV2:Harvest", async ({ event, context }) => {
  const harvestId = event.log.id;
  const yieldToken = event.args.yieldToken;
  const blockNumber = event.block.number;
  const totalHarvested = event.args.totalHarvested;

  // Insert harvest event details
  await context.db.insert(schema.harvestEvent).values({
    id: harvestId,
    blockNumber: blockNumber,
    yieldToken: yieldToken,
    totalHarvested: totalHarvested,
    credit: event.args.credit,
    network: context.network.name,
  });

  // Query depositors for this yield token
  const depositorsList = await context.db.sql
    .select({ depositor: schema.depositors.depositor })
    .from(schema.depositors)
    .where(
      and(
        eq(schema.depositors.depositedYieldToken, yieldToken),
        eq(schema.depositors.network, context.network.name)
      )
    );

  // Fetch yield token parameters
  const yieldTokenParameters = await context.client.readContract({
    address: event.log.address,
    abi: context.contracts.AlchemistV2.abi,
    functionName: "getYieldTokenParameters",
    args: [yieldToken],
  });

  const totalAlchemistShares = yieldTokenParameters.totalShares;
  const yieldTokenDecimals = yieldTokenParameters.decimals;

  // Fetch protocol fee and convert to decimal
  const protocolFee = ((value: bigint, divisor: number): number =>
    Number(value) / divisor)(
    await context.client.readContract({
      address: event.log.address,
      abi: context.contracts.AlchemistV2.abi,
      functionName: "protocolFee",
    }),
    10000
  );

  /**
   * Handles harvest calculations for all depositors
   *
   * @param {any} context - Ponder context
   * @param {Array} depositorsList - List of depositors
   * @param {string} yieldToken - Yield token address
   * @param {string} harvestId - Unique harvest event ID
   * @param {number} blockNumber - Block number of the harvest event
   */
  const handleHarvest = async (
    context: any,
    depositorsList: { depositor: string }[],
    yieldToken: string,
    harvestId: string,
    blockNumber: number
  ) => {
    // Prepare multicall to fetch user positions efficiently
    const calls = preparePositionCalls(
      context,
      event,
      depositorsList.map((depositor) => depositor.depositor),
      yieldToken
    );

    // Execute multicall to fetch positions
    const results: any[] = await context.client.multicall({
      contracts: calls,
      allowFailure: false,
    });

    // Calculate user earnings based on their shares
    const sharesData = results.map((result, index) => ({
      id: uuidv4(),
      depositor: depositorsList[index]!.depositor,
      yieldToken: yieldToken,
      harvestId: harvestId,
      shares: result[0],
      totalAlchemistShares: totalAlchemistShares,
      userEarnings:
        (Number(totalHarvested) * (1 - protocolFee) * Number(result[0])) /
        Number(totalAlchemistShares) /
        10 ** yieldTokenDecimals,
      blockNumber: blockNumber,
      network: context.network.name,
    }));

    // Insert user harvest shares
    await context.db.insert(schema.userHarvestShares).values(sharesData);

    // Update total earnings for each depositor
    const updatePromises = sharesData.map((share) =>
      context.db
        .update(schema.depositors, {
          depositor: share.depositor,
          depositedYieldToken: share.yieldToken,
          network: share.network,
        })
        .set((row: any) => ({
          totalUnderlyingTokenEarned:
            row.totalUnderlyingTokenEarned + share.userEarnings,
        }))
    );

    await Promise.all(updatePromises);
  };

  // Execute harvest handling
  await handleHarvest(
    context,
    depositorsList,
    yieldToken,
    harvestId,
    Number(blockNumber)
  );
});

/**
 * Handles the Donate event
 * Calculates and records donation shares for users
 *
 * Key steps:
 * 1. Insert donate event details
 * 2. Fetch all depositors for the yield token
 * 3. Retrieve yield token parameters
 * 4. Use multicall to fetch user positions
 * 5. Calculate and record user donation shares
 */
ponder.on("AlchemistV2:Donate", async ({ event, context }) => {
  const donateId = event.log.id;
  const yieldToken = event.args.yieldToken;
  const blockNumber = event.block.number;
  const debtTokensBurned = event.args.amount;

  // Insert donate event details
  await context.db.insert(schema.donateEvent).values({
    id: donateId,
    blockNumber: blockNumber,
    yieldToken: yieldToken,
    debtTokensBurned: debtTokensBurned,
    network: context.network.name,
  });

  // Query depositors for this yield token
  const depositorsList = await context.db.sql
    .select({ depositor: schema.depositors.depositor })
    .from(schema.depositors)
    .where(
      and(
        eq(schema.depositors.depositedYieldToken, yieldToken),
        eq(schema.depositors.network, context.network.name)
      )
    );

  // Fetch yield token parameters
  const yieldTokenParameters = await context.client.readContract({
    address: event.log.address,
    abi: context.contracts.AlchemistV2.abi,
    functionName: "getYieldTokenParameters",
    args: [yieldToken],
  });

  const totalAlchemistShares = yieldTokenParameters.totalShares;

  /**
   * Handles donation calculations for all depositors
   *
   * @param {any} context - Ponder context
   * @param {Array} depositorsList - List of depositors
   * @param {string} yieldToken - Yield token address
   * @param {string} donateId - Unique donate event ID
   * @param {number} blockNumber - Block number of the donate event
   */
  const handleDonate = async (
    context: any,
    depositorsList: { depositor: string }[],
    yieldToken: string,
    donateId: string,
    blockNumber: number
  ) => {
    // Prepare multicall to fetch user positions efficiently
    const calls = preparePositionCalls(
      context,
      event,
      depositorsList.map((depositor) => depositor.depositor),
      yieldToken
    );

    // Execute multicall to fetch positions
    const results: any[] = await context.client.multicall({
      contracts: calls,
      allowFailure: false,
    });

    // Calculate user donation shares
    const sharesData = results.map((result, index) => ({
      id: uuidv4(),
      depositor: depositorsList[index]!.depositor,
      yieldToken: yieldToken,
      donateId: donateId,
      shares: result[0],
      totalAlchemistShares: totalAlchemistShares,
      donationReceived:
        (Number(debtTokensBurned) * Number(result[0])) /
        Number(totalAlchemistShares) / // user's share ratio
        10 ** 18, // Donations are done with alETH/alUSD with 18 decimals
      blockNumber: blockNumber,
      network: context.network.name,
    }));

    // Insert user donation shares
    await context.db.insert(schema.userDonateShares).values(sharesData);

    // Update total donation received for each depositor
    const updatePromises = sharesData.map((share) =>
      context.db
        .update(schema.depositors, {
          depositor: share.depositor,
          depositedYieldToken: share.yieldToken,
          network: share.network,
        })
        .set((row: any) => ({
          totalDonationReceived:
            row.totalDonationReceived + share.donationReceived,
        }))
    );

    await Promise.all(updatePromises);
  };

  // Execute donation handling
  await handleDonate(
    context,
    depositorsList,
    yieldToken,
    donateId,
    Number(blockNumber)
  );
});
