
const { interpolateValue } = require('./helpers.ts');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function closeTo(a, b, epsilon = 0.000001) {
    return Math.abs(a - b) < epsilon;
}

function testInterpolateValue() {
    console.log("Running interpolateValue tests...");

    // Test Case 1: Numeric interpolation (middle)
    const keyframes1 = [
        { offset: 0, value: 0 },
        { offset: 1, value: 100 }
    ];
    assert(closeTo(interpolateValue(keyframes1, 5, 10), 50), "Numeric interpolation (0.5) failed");

    // Test Case 2: Numeric interpolation (quarter)
    assert(closeTo(interpolateValue(keyframes1, 2.5, 10), 25), "Numeric interpolation (0.25) failed");

    // Test Case 3: Non-numeric selection (before 0.5)
    const keyframes2 = [
        { offset: 0, value: "red" },
        { offset: 1, value: "blue" }
    ];
    assert(interpolateValue(keyframes2, 4, 10) === "red", "Non-numeric selection (0.4) failed");

    // Test Case 4: Non-numeric selection (after 0.5)
    assert(interpolateValue(keyframes2, 6, 10) === "blue", "Non-numeric selection (0.6) failed");

    // Test Case 5: Time clamping (below 0)
    assert(interpolateValue(keyframes1, -5, 10) === 0, "Clamping below 0 failed");

    // Test Case 6: Time clamping (above duration)
    assert(interpolateValue(keyframes1, 15, 10) === 100, "Clamping above duration failed");

    // Test Case 7: Exact keyframe match
    assert(interpolateValue(keyframes1, 0, 10) === 0, "Exact match at 0 failed");
    assert(interpolateValue(keyframes1, 10, 10) === 100, "Exact match at end failed");

    // Test Case 8: Multiple keyframes
    const keyframes3 = [
        { offset: 0, value: 0 },
        { offset: 0.2, value: 10 },
        { offset: 1, value: 100 }
    ];

    assert(closeTo(interpolateValue(keyframes3, 1, 10), 5), "Multiple keyframes (0.1) failed");
    assert(closeTo(interpolateValue(keyframes3, 6, 10), 55), "Multiple keyframes (0.6) failed");

    console.log("All tests passed!");
}

try {
    testInterpolateValue();
} catch (error) {
    console.error("Test failed!");
    console.error(error.stack);
    process.exit(1);
}
