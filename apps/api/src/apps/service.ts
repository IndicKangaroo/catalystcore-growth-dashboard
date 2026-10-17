import type { AppRecord, CreateAppInput, UpdateAppInput } from '@growth/shared';
import { AppError } from '../middleware/errors';
import type { AppRepository } from './types';

export interface AppServiceOptions {
  repo: AppRepository;
  now?: () => Date;
}

export interface AppService {
  list(): Promise<AppRecord[]>;
  get(id: string): Promise<AppRecord>;
  create(input: CreateAppInput, actorEmail: string): Promise<AppRecord>;
  update(id: string, patch: UpdateAppInput): Promise<AppRecord>;
  remove(id: string): Promise<void>;
}

const appNotFound = () => new AppError(404, 'app_not_found', 'No such app');

const packageNameTaken = (packageName: string, owner: AppRecord) =>
  new AppError(
    409,
    'package_name_taken',
    `${owner.name} already uses the package name ${packageName}`,
  );

// Package names are compared without regard to letter case, so "Com.Example.App" cannot be added
// next to "com.example.app" by mistake.
const samePackage = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** By name, ignoring letter case; the id settles ties so the order never changes between reads. */
function compareApps(a: AppRecord, b: AppRecord): number {
  return (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id)
  );
}

/**
 * Applies a change to an app. A field the patch leaves out stays as it is; an optional field sent
 * as null is cleared. The three required fields cannot be null, which the schema already refused.
 */
function applyPatch(current: AppRecord, patch: UpdateAppInput, updatedAt: string): AppRecord {
  return {
    ...current,
    name: patch.name ?? current.name,
    packageName: patch.packageName ?? current.packageName,
    status: patch.status ?? current.status,
    iconUrl: patch.iconUrl === undefined ? current.iconUrl : patch.iconUrl,
    ga4PropertyId: patch.ga4PropertyId === undefined ? current.ga4PropertyId : patch.ga4PropertyId,
    firebaseProjectId:
      patch.firebaseProjectId === undefined ? current.firebaseProjectId : patch.firebaseProjectId,
    playStoreUrl: patch.playStoreUrl === undefined ? current.playStoreUrl : patch.playStoreUrl,
    launchDate: patch.launchDate === undefined ? current.launchDate : patch.launchDate,
    category: patch.category === undefined ? current.category : patch.category,
    currentVersion:
      patch.currentVersion === undefined ? current.currentVersion : patch.currentVersion,
    updatedAt,
  };
}

export function createAppService(options: AppServiceOptions): AppService {
  const { repo } = options;
  const now = options.now ?? (() => new Date());

  return {
    async list() {
      const apps = await repo.list();
      return apps.sort(compareApps);
    },

    async get(id) {
      const app = await repo.get(id);
      if (!app) throw appNotFound();
      return app;
    },

    async create(input, actorEmail) {
      return repo.runTransaction(async (tx) => {
        const existing = await tx.list();
        const clash = existing.find((app) => samePackage(app.packageName, input.packageName));
        if (clash) throw packageNameTaken(input.packageName, clash);

        const timestamp = now().toISOString();
        const created: AppRecord = {
          ...input,
          id: repo.newId(),
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: actorEmail,
        };
        tx.put(created);
        return created;
      });
    },

    async update(id, patch) {
      return repo.runTransaction(async (tx) => {
        const current = await tx.get(id);
        if (!current) throw appNotFound();

        const packageName = patch.packageName;
        if (packageName !== undefined && !samePackage(packageName, current.packageName)) {
          const others = await tx.list();
          const clash = others.find(
            (app) => app.id !== id && samePackage(app.packageName, packageName),
          );
          if (clash) throw packageNameTaken(packageName, clash);
        }

        const next = applyPatch(current, patch, now().toISOString());
        tx.put(next);
        return next;
      });
    },

    // Campaigns, links and posts will point at an app (P5). Deleting is allowed here because
    // nothing refers to an app yet; P5 must refuse it while something does.
    async remove(id) {
      await repo.runTransaction(async (tx) => {
        const current = await tx.get(id);
        if (!current) throw appNotFound();
        tx.delete(id);
      });
    },
  };
}
