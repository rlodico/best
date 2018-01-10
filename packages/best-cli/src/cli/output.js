import Table from "cli-table";
import chalk from "chalk";

const padding = (n) => (n > 0 ? Array.apply(null, Array((n - 1) * 3)).map(() => ' ').join('') + '└─ ' : '');

function generateRow(benchmarks, table, level = 0) {
    benchmarks.forEach((benchmarkNode) => {
        const name = benchmarkNode.name;
        // Root benchmark
        if (!benchmarkNode.benchmarks) {
            Object.keys(benchmarkNode).forEach((metric) => {
                const metricValues = benchmarkNode[metric];
                if (metricValues && metricValues.sampleSize) {
                    const { sampleSize, mean, median, variance, medianAbsoluteDeviation } = metricValues;
                    table.push([
                        padding(level) + name,
                        chalk.bold(metric),
                        sampleSize,
                        mean.toFixed(4),
                        median.toFixed(4),
                        variance.toFixed(4),
                        medianAbsoluteDeviation.toFixed(4)
                    ]);
                }
            });
        // Group
        } else {
            const emptyFields = Array.apply(null, Array(6)).map(() => '-');
            table.push([padding(level) + name, ...emptyFields]);
            generateRow(benchmarkNode.benchmarks, table, level + 1);
        }
    });
}

function generateStats(benchmarkName, outputFolder, stats, stream) {
    const table = new Table({
        head: ['Benchmark name', 'Metric', 'N', 'Mean', 'Median', 'Variance', 'MedianAbsDeviation'],
        colWidths: [32, 14, 6, 12, 12, 12, 12]
    });

    generateRow(stats, table);

    stream.write([
        chalk.bold.dim('\n Benchmark results for ') + chalk.bold.magentaBright(benchmarkName),
        chalk.italic(' ' + outputFolder + '/'),
        table.toString() + '\n'
    ].join('\n'));
}

function generateEnviroment({ hardware, browser }, stream) {
    const cpuLoad = hardware.load.cpuLoad;
    const loadColor = cpuLoad < 10 ? 'green' : cpuLoad < 50 ? 'yellow' : 'red';

    stream.write(' ');
    stream.write([
        'Browser version:    ' + chalk.bold(browser.version),
        `Benchmark CPU load: ${chalk.bold[loadColor](cpuLoad.toFixed(3) + '%')}`
    ].join('\n '));

    stream.write('\n\n');
}

export function generateReportTables(results, stream) {
    results.forEach((result) => {
        const { benchmarkName, benchmarkOutputResult, stats } = result;
        generateStats(benchmarkName, benchmarkOutputResult, stats.benchmarks, stream);
        generateEnviroment(stats.environment, stream);
    });
}


export function generateComparisonTable(comparison, stream) {
    console.log('WIP: OUTPUT Comparison table here!');
    console.log(comparison);
}