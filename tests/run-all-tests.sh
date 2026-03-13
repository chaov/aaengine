#!/bin/bash

echo "================================"
echo "AAEngine QA Test Suite"
echo "================================"
echo ""

echo "1. Running Zig Unit Tests..."
echo "----------------------------"
zig test tests/zig/memory_manager_test.zig --test-no-exec 2>&1 | tee tests/reports/zig-test.log
ZIG_TEST_STATUS=${PIPESTATUS[0]}

echo ""
echo "2. Running TypeScript Tests..."
echo "-------------------------------"
cd tests/typescript
npm install --silent
npm test 2>&1 | tee ../reports/typescript-test.log
TS_TEST_STATUS=${PIPESTATUS[0]}
cd ../..

echo ""
echo "3. Running Performance Benchmarks..."
echo "------------------------------------"
node tests/benchmark/benchmark.ts 2>&1 | tee tests/reports/benchmark.log
BENCHMARK_STATUS=${PIPESTATUS[0]}

echo ""
echo "================================"
echo "Test Summary"
echo "================================"
echo "Zig Tests: $([ $ZIG_TEST_STATUS -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "TypeScript Tests: $([ $TS_TEST_STATUS -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "Benchmarks: $([ $BENCHMARK_STATUS -eq 0 ] && echo 'COMPLETED' || echo 'FAILED')"
echo ""

if [ $ZIG_TEST_STATUS -eq 0 ] && [ $TS_TEST_STATUS -eq 0 ]; then
    echo "All tests PASSED!"
    exit 0
else
    echo "Some tests FAILED!"
    exit 1
fi
