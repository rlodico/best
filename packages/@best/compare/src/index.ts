import { compareSamples } from '@best/analyzer';

// function compareEnvironment(/* baseEnv, targetEnv */) {
//     // TODO
// }

function compareBenchmarks(baseBenchs: any, targetBenchs: any, comparison: any = []) {
    if (baseBenchs && baseBenchs.length && targetBenchs && targetBenchs.length) {
        baseBenchs.forEach((baseBenchmark: any) => {
            const targetBenchmark = targetBenchs.find((tb: any) => tb.name === baseBenchmark.name);
            if (!targetBenchmark) {
                console.log(
                    `Skipping benchmark test ${baseBenchmark.name} since we couldn't find it in target.` +
                        'The test has probably been changed between commits',
                );
                return;
            }

            if (baseBenchmark.benchmarks) {
                comparison.push(...compareBenchmarks(baseBenchmark.benchmarks, targetBenchmark.benchmarks));
            } else {
                // For now compare only duration metrics, we should compare more things
                const baseDurationMetrics = baseBenchmark.duration;
                const targetDurationMetrics = targetBenchmark.duration;
                const durationSampleComparison = compareSamples(
                    baseDurationMetrics.samples,
                    targetDurationMetrics.samples,
                );

                comparison.push({
                    name: baseBenchmark.name,
                    metrics: {
                        duration: {
                            // hardcoded for now
                            baseStats: baseDurationMetrics,
                            targetStats: targetDurationMetrics,
                            samplesComparison: durationSampleComparison, // Returns `-1` if slower, `1` if faster, and `0` if indeterminate.
                        },
                    },
                });
            }
        });
    }

    return comparison;
}

export async function compareBenchmarkStats(baseCommit: string, targetCommit: string, projectNames: string[], storageProvider: any) {
    const stats = await Promise.all(
        projectNames.reduce((reducer: any, projectName) => [
            ...reducer,
            storageProvider.getAllBenchmarkStatsPerCommit(projectName, baseCommit),
            storageProvider.getAllBenchmarkStatsPerCommit(projectName, targetCommit)
        ], [])
    );

    if (stats.length % 2) {
        throw new Error('Recovered odd number of stats to compare');
    }

    // preRunMessager.print('\n Running comparison... \n\n', process.stdout);

    const commitComparison: any = {
        baseCommit,
        targetCommit,
        comparison: [],
    };

    while (stats.length) {
        const baseBenchmarks: any = stats.shift();
        const targetBenchmarks: any = stats.shift();

        baseBenchmarks.forEach((baseBenchmarkBundle: any) => {
            const { benchmarkName, projectName }: { benchmarkName: string, projectName: string } = baseBenchmarkBundle;
            const targetBenchmarkBundle = targetBenchmarks.find((b: any) => b.benchmarkName === benchmarkName);
            if (!targetBenchmarkBundle) {
                console.log(`Skipping benchmark ${benchmarkName} since we couldn't find it in commit ${targetCommit}`);
                return;
            }
            const { version: baseVersion, /*environment: baseEnv,*/ benchmarks: baseBenchs } = baseBenchmarkBundle;
            const { version: targetVersion, /*environment: targetEnv,*/ benchmarks: targetBenchs } = targetBenchmarkBundle;

            if (baseVersion !== targetVersion) {
                console.log(`Skipping comparing ${benchmarkName} since stat versions are different`);
            }

            // compareEnvironment(baseEnv, targetEnv);

            const comparison = compareBenchmarks(baseBenchs, targetBenchs);
            commitComparison.comparison.push({ projectName, benchmarkName, comparison });
        });
    }

    return commitComparison;
}