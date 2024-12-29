# Alchemix User Earnings Subgraph

## Description

This subgraph is an indexing tool for tracking user earnings across Alchemix protocol deployments. Built using the [Ponder.sh](https://ponder.sh) library, it indexes events emitted from the AlchemistV2 contracts across multiple networks.

## Key Features

- 🌐 Multi-chain Support: Indexes AlchemistV2 deployments on Mainnet, Arbitrum, and Optimism
- 📊 Comprehensive Tracking:
  - User deposits
  - Harvest events
  - Yield token additions
- 🔍 Detailed Earnings Analysis
- 🖥️ Self-hosted with integrated database
- 🚀 Compatible with free public RPCs
- 💾 Optional PostgreSQL database support

## Prerequisites

- Node.js (v18+ recommended)
- pnpm package manager

## Installation

1. Clone the repository:

```bash
git clone https://github.com/pastelfork/alchemix-user-earnings-subgraph.git
cd alchemix-user-earnings-subgraph
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

- Copy `.env.local.example` to `.env.local`
- Configure your RPC endpoints and other necessary settings

## Running the Subgraph

### Development Mode

```bash
pnpm dev
```

### Production Mode

```bash
pnpm start --schema [DATABASE_SCHEMA]
```

_Replace `[DATABASE_SCHEMA]` with a unique identifier for your schema version_

## Accessing GraphQL Interface

After starting the subgraph, you can access:

- GraphQL Interface: `http://localhost:42069`
- GraphQL Queries: `http://localhost:42069/graphql`

**Note:** Indexing completion time varies depending on RPC rate limits but should be completed within 1 hour on free public RPCs, after which the indexer will continue listening for new events and run processing in realtime.

## Configuration

The `ponder.config.ts` file provides configuration options for network and contract settings:

### Network Configuration

- Adds support for new AlchemistV2 deployments by adding:
  - AlchemistV2 deployment addresses for the new chain
  - RPC endpoints for the new chain

### RPC Endpoint Customization

- Default configuration uses public RPC endpoints with rate limiting
- Supports load balancing across multiple RPC providers
- Replace with private or paid RPC endpoints for:
  - Improved synchronization
  - Higher request rates

## Database Options

- Built-in database (default)
- Optional PostgreSQL support (see [Ponder docs](https://ponder.sh/docs/getting-started/database))
