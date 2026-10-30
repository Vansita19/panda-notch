#!/bin/zsh
set -eu
cd "$(dirname "$0")/.."
test_build=$(mktemp -d /private/tmp/panda-campaign-tests-build.XXXXXX)
trap 'rm -rf "$test_build"' EXIT
swiftc -module-cache-path /private/tmp/panda-swift-module-cache native/CampaignBridge.swift native/tests/CampaignBridgeTests.swift -o "$test_build/bridge-tests"
"$test_build/bridge-tests"
