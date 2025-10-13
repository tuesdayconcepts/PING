# Railway Dockerfile for Prisma + TypeScript backend
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (this will run prisma generate via postinstall)
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build TypeScript
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package.json for runtime dependencies
COPY package*.json ./

# Copy built files and dependencies
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

