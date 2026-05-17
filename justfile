# Iedora monorepo — root entry point.
#
# Each product is self-contained under products/<name>/, with its own
# justfile, Tofu root, and .env. This file exposes them as just modules:
#
#   just menu::deploy           → cd products/menu/infra/ && just deploy
#   just menu::logs             → same, kamal app logs
#   just house::deploy          → cd products/house/infra/ && just deploy
#   just menu                   → list menu's recipes
#   just house                  → list house's recipes
#   just                        → list this file (and the modules below)
#
# Add a 3rd product:
#   1. mkdir products/<name>/
#   2. cp products/house/infra/{justfile,bin/with-secrets,.env.example} into it
#   3. echo "mod <name> 'products/<name>/infra'" appended to this file

mod menu 'products/menu/infra'
mod house 'products/house/infra'
mod genkan 'products/genkan/infra'

# Default: list modules + recipes.
[private]
_default:
    @just --list
