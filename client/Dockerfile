FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Rewrites (/api → FastAPI) and NEXT_PUBLIC_* values are fixed at build time.
ARG API_INTERNAL_URL=http://server:8000
ARG NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_KAKAO_MAP_APP_KEY=$NEXT_PUBLIC_KAKAO_MAP_APP_KEY
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
