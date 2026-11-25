import { createContext, useContext } from 'react';
import type { ModuleManifest } from '@core';

export const ModulesContext = createContext<readonly ModuleManifest[]>([]);

/** Every module that loaded. The analysis module uses it to collect loadExperiments() from all of them. */
export const useModules = (): readonly ModuleManifest[] => useContext(ModulesContext);
