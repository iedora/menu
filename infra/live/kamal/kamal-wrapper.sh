#!/usr/bin/env bash
# Wrapper: injecta `-c infra/live/kamal/deploy.yml` DEPOIS do subcommand
# Kamal v2 só aceita -c na posição de option do subcommand (não global).
# Uso: ./kamal-wrapper.sh <subcommand> [args]
exec kamal "$1" -c infra/live/kamal/deploy.yml "${@:2}"
