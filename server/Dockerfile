FROM node:20-alpine

# Prisma's query/migration engines are dynamically linked against OpenSSL —
# without it, the engine binary fails to start and Prisma can't even parse
# its own error output ("Unexpected token 'E'... is not valid JSON").
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
