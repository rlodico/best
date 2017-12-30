import puppeteer from "puppeteer";
import { getSystemInfo } from "./system-info";
import path from "path";

const BROWSER_ARGS = [
    '--no-sandbox',
    `--js-flags=--expose-gc`,
    '--disable-infobars',
    '--disable-background-networking',
    '--disable-extensions',
    '--disable-translate',
    '--no-first-run',
    '--ignore-certificate-errors',
    '--enable-precise-memory-info',
];

const PUPPETEER_OPTIONS = { args: BROWSER_ARGS };

async function runIteration(page, state, opts) {
    // eslint-disable-next-line no-undef
    const results = await page.evaluate(async (o) => BEST.runBenchmark(o), opts);

    return results;
}

async function runIterations(page, state, opts, messager) {
    if (state.executedTime < opts.maxDuration || state.executedIterations < opts.minSampleCount) {
        const start = Date.now();
        const results = await runIteration(page, state, opts);
        await page.reload();

        state.executedTime += (Date.now() - start);
        state.executedIterations += 1;
        //console.log('>>', JSON.stringify(results, null, '  '), '\n ==================================== \n');
        if (state.iterateOnClient) {
            state.results.push(...results.results);
        } else {
            state.results.push(results.results[0]);
        }
        messager.updateBenchmarkProgress(state, opts);

        if (state.iterateOnClient) {
            return state;
        }

        return runIterations(page, state, opts, messager);
    }

    return state;
}

function normalizeRuntimeOptions(proyectConfig) {
    const { benchmarkIterations, benchmarkOnClient } = proyectConfig;
    const definedIterations =  Number.isInteger(benchmarkIterations);

    // For benchmarking on the client or a defined number of iterations duration is irrelevant
    const maxDuration = (definedIterations || benchmarkOnClient) ? 1 : proyectConfig.benchmarkMaxDuration;
    const minSampleCount = definedIterations ? benchmarkIterations : proyectConfig.benchmarkMinIterations;

    return {
        maxDuration,
        minSampleCount,
        iterations: benchmarkIterations,
        iterateOnClient: benchmarkOnClient,
    };
}

function initializeBenchmarkState(opts) {
    return {
        executedTime: 0,
        executedIterations: 0,
        results: [],
        iterateOnClient: opts.iterateOnClient
    };
}

async function normalizeEnvironment(browser, proyectConfig) {
    const { benchmarkOnClient, benchmarkRunner, benchmarkEnvironment, benchmarkIterations } = proyectConfig;
    const hardware = await getSystemInfo();
    const version = await browser.version();
    return {
        hardware,
        browser: { version, options: BROWSER_ARGS },
        configuration: {
            proyect: {
                benchmarkOnClient,
                benchmarkRunner,
                benchmarkEnvironment,
                benchmarkIterations
            },
            global: {
                version: "alpha",
                "commit": "-"
            }
        }
    };
}

export async function run(benchmarkEntry, proyectConfig, globalConfig, messager) {
    return puppeteer.launch(PUPPETEER_OPTIONS).then(async browser => {
        const opts =  normalizeRuntimeOptions(proyectConfig);
        const state =  initializeBenchmarkState(opts);
        const environment = await normalizeEnvironment(browser, proyectConfig, globalConfig);

        const page = await browser.newPage();
        await page.goto('file:///' + benchmarkEntry);

        const benchmarkResults = await runIterations(page, state, opts, messager);
        await browser.close();
        return { results: benchmarkResults.results, environment };
    });
}
