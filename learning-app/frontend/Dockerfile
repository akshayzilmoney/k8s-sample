FROM nginx:stable-alpine
# Pull in security fixes for Alpine packages released after the base image was built
RUN apk upgrade --no-cache
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
