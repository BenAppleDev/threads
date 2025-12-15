FROM ruby:2.4.10

# Debian buster is EOL; point apt to archive mirrors so apt-get works
RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list && \
    sed -i 's|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g' /etc/apt/sources.list && \
    sed -i '/buster-updates/d' /etc/apt/sources.list && \
    apt-get -o Acquire::Check-Valid-Until=false update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      nodejs \
      git \
      libpq-dev \
      sqlite3 \
      libsqlite3-dev \
      tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN gem install bundler -v 1.17.3 --no-document
RUN bundle install

CMD sh -lc "bundle exec sidekiq --concurrency 2 & bundle exec puma -C config/puma.rb"
