/** The analysis module's own growth experiments. Other modules' experiments come in through useModules(). */
import type { GrowthExperiment } from '@core';
import { binarySearchExperiment } from './binarySearch';
import { insertionSortExperiment } from './insertionSort';

export const experiments: readonly GrowthExperiment[] = [binarySearchExperiment, insertionSortExperiment];
