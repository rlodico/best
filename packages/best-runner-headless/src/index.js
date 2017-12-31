import puppeteer from "puppeteer";
import { getSystemInfo } from "./system-info";
import path from "path";
import { clearInterval } from "timers";

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
const UPDATE_INTERVAL = 300;
const PUPPETEER_OPTIONS = { args: BROWSER_ARGS };

async function runIteration(page, state, opts) {
    // eslint-disable-next-line no-undef
    return page.evaluate(async (o) => BEST.runBenchmark(o), opts);
}

async function runClientIterations(page, state, opts, messager) {
    // Run an iteration to estimate the time it will take
    const testResult = await runIteration(page, state, { iterations : 1 });
    const estimatedIterationTime = testResult.executedTime;

    const start = Date.now();
    // eslint-disable-next-line lwc/no-set-interval
    const intervalId = setInterval(() => {
        const executing = Date.now() - start;
        state.executedTime = executing;
        state.executedIterations = Math.round(executing / estimatedIterationTime);
        messager.updateBenchmarkProgress(state, opts);
    }, UPDATE_INTERVAL);

    await page.reload();
    const clientRawResults = await runIteration(page, state, opts);
    clearInterval(intervalId);

    const results = clientRawResults.results;
    state.results.push(...results);

    return state;
}

async function runServerIterations(page, state, opts, messager) {
    if (state.executedTime < opts.maxDuration || state.executedIterations < opts.minSampleCount) {
        const start = Date.now();
        const results = await runIteration(page, state, opts);
        await page.reload();

        state.executedTime += (Date.now() - start);
        state.executedIterations += 1;
        state.results.push(results.results[0]);
        messager.updateBenchmarkProgress(state, opts);
        return runIterations(page, state, opts, messager);
    }

    return state;
}

async function runIterations(page, state, opts, messager) {
    if (state.iterateOnClient) {
        return runClientIterations(page, state, opts, messager);
    }
    return runServerIterations(page, state, opts, messager);
}

function normalizeRuntimeOptions(proyectConfig) {
    const { benchmarkIterations, benchmarkOnClient } = proyectConfig;
    const definedIterations =  Number.isInteger(benchmarkIterations);
    // For benchmarking on the client or a defined number of iterations duration is irrelevant
    const maxDuration = definedIterations ? 1 : proyectConfig.benchmarkMaxDuration;
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

async function normalizeEnvironment(browser, proyectConfig, globalConfig) {
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
                commitHash: globalConfig.gitCommit,
                hasLocalGitChanges: globalConfig.gitLocalChanges

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