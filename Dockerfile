FROM node:24-alpine AS build
WORKDIR /app
COPY config*.mjs build.mjs ./
COPY src ./src
RUN node build.mjs

FROM nginx:stable-alpine
COPY --from=build /app/dist/index.html /usr/share/nginx/html/index.html
COPY --from=build /app/deploy/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/deploy/nav-health-common.conf /etc/nginx/nav-health-common.conf
EXPOSE 80
