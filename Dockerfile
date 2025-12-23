# Use a lightweight Node.js image for the build stage
FROM node:20.18.1-alpine3.21 AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy only package.json and pnpm-lock.yaml to install dependencies first (for better cache)
COPY package.json pnpm-lock.yaml ./

#RUN apk add --no-cache bash && corepack enable
RUN npm install -g pnpm

#RUN wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -

# Install dependencies using pnpm (only production dependencies)
RUN pnpm install 

# Copy the rest of the application code and build the NestJS application
COPY . .
RUN pnpm build

# Use a smaller base image for the final stage
FROM node:20.18.1-alpine3.21 AS runner

# Set NODE_ENV to production for runtime optimizations
ENV NODE_ENV=production

# Set the working directory inside the container
WORKDIR /usr/src/app

RUN npm install -g pnpm && apk add --no-cache curl

# Copy only the required files
COPY --from=builder /usr/src/app/ ./

# Expose the port
EXPOSE 3000

# Command to run the application
CMD ["pnpm", "start:prod"]
