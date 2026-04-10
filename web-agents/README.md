This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment Variables

This application requires Azure OpenAI and Azure Blob Storage configuration. Create a `.env.local` file in the `web-agents` directory with the following variables:

```bash


# Azure Blob Storage Configuration (for file uploads)
# Option 1: Use connection string (recommended)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your-account-name;AccountKey=your-account-key;EndpointSuffix=core.windows.net

# Option 2: Use account name and key separately
# AZURE_STORAGE_ACCOUNT_NAME=your-account-name
# AZURE_STORAGE_ACCOUNT_KEY=your-account-key

# Optional: Container name (defaults to "chat-files" if not specified)
# AZURE_STORAGE_CONTAINER_NAME=chat-files
```

**To get Azure OpenAI values:**
1. Navigate to your Azure OpenAI resource in the Azure Portal
2. Go to "Keys and Endpoint" section
3. Copy the **Endpoint** (use the full URL)
4. Copy one of the **Keys** (either KEY1 or KEY2)
5. Go to "Deployments" section to find your **Deployment Name** (e.g., "gpt-4", "gpt-35-turbo", etc.)

**To get Azure Blob Storage values:**
1. Navigate to your Azure Storage Account in the Azure Portal
2. Go to "Access keys" section
3. Copy the **Connection string** (recommended) OR copy the **Storage account name** and one of the **Keys**
4. The container will be created automatically if it doesn't exist (default name: "chat-files")

### Installing Dependencies

First, install the dependencies:

```bash
npm install
```

**Note:** This project requires Node.js version 20.19+, 22.12+, or 24.0+. If you encounter installation issues, please upgrade your Node.js version.

### Running the Development Server

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
