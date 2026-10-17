import { APP_STATUSES, APP_STATUS_LABELS, appStatusSchema, createAppSchema } from '@growth/shared';
import type { AppRecord, AppResponse } from '@growth/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Notice } from '../../components/Notice';
import { SelectField, TextField } from '../../components/fields';
import { apiFetch } from '../../lib/api';
import { APPS_KEY } from './queries';

const FIELD_NAMES = [
  'name',
  'packageName',
  'status',
  'category',
  'currentVersion',
  'launchDate',
  'ga4PropertyId',
  'firebaseProjectId',
  'playStoreUrl',
  'iconUrl',
] as const;
type FieldName = (typeof FIELD_NAMES)[number];

/** What the boxes hold. Every box holds text; the shared schema turns it into an app. */
type FormValues = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

function isFieldName(value: unknown): value is FieldName {
  return FIELD_NAMES.some((name) => name === value);
}

function valuesFor(app: AppRecord | undefined): FormValues {
  return {
    name: app?.name ?? '',
    packageName: app?.packageName ?? '',
    status: app?.status ?? 'development',
    category: app?.category ?? '',
    currentVersion: app?.currentVersion ?? '',
    launchDate: app?.launchDate ?? '',
    ga4PropertyId: app?.ga4PropertyId ?? '',
    firebaseProjectId: app?.firebaseProjectId ?? '',
    playStoreUrl: app?.playStoreUrl ?? '',
    iconUrl: app?.iconUrl ?? '',
  };
}

interface AppFormProps {
  /** The app being edited; leave it out to add a new one. */
  app?: AppRecord;
  onClose: () => void;
}

/**
 * The add and edit form (admins only; the API checks that again). It checks the boxes with the same
 * schema the API uses and says what is wrong next to the box, then sends the cleaned-up values. A
 * box left empty clears an optional field when editing.
 */
export function AppForm({ app, onClose }: AppFormProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>(() => valuesFor(app));
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = useMutation({
    mutationFn: (body: unknown) =>
      app
        ? apiFetch<AppResponse>(`/api/apps/${encodeURIComponent(app.id)}`, {
            method: 'PATCH',
            body,
          })
        : apiFetch<AppResponse>('/api/apps', { method: 'POST', body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: APPS_KEY });
      onClose();
    },
  });

  function setValue(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createAppSchema.safeParse(values);
    if (!parsed.success) {
      const found: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (isFieldName(field) && !found[field]) found[field] = issue.message;
      }
      setErrors(found);
      save.reset();
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  const title = app ? `Edit ${app.name}` : 'Add an app';

  return (
    <Card className="p-5">
      <h2 id="app-form-title" className="text-base font-semibold text-fg">
        {title}
      </h2>
      <form
        aria-labelledby="app-form-title"
        onSubmit={handleSubmit}
        noValidate
        className="mt-4 flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="app-name"
            label="Name"
            showRequired
            required
            autoFocus
            value={values.name}
            onChange={(event) => setValue('name', event.target.value)}
            error={errors.name}
          />
          <TextField
            id="app-package"
            label="Package name"
            showRequired
            required
            value={values.packageName}
            onChange={(event) => setValue('packageName', event.target.value)}
            hint="The Android application ID, written like com.example.myapp."
            error={errors.packageName}
          />
          <SelectField
            id="app-status"
            label="Status"
            value={values.status}
            onChange={(event) => setValue('status', appStatusSchema.parse(event.target.value))}
            error={errors.status}
          >
            {APP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {APP_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
          <TextField
            id="app-category"
            label="Category"
            value={values.category}
            onChange={(event) => setValue('category', event.target.value)}
            error={errors.category}
          />
          <TextField
            id="app-version"
            label="Current version"
            value={values.currentVersion}
            onChange={(event) => setValue('currentVersion', event.target.value)}
            error={errors.currentVersion}
          />
          <TextField
            id="app-launch"
            label="Launch date"
            type="date"
            value={values.launchDate}
            onChange={(event) => setValue('launchDate', event.target.value)}
            error={errors.launchDate}
          />
          <TextField
            id="app-ga4"
            label="GA4 property ID"
            value={values.ga4PropertyId}
            onChange={(event) => setValue('ga4PropertyId', event.target.value)}
            hint="The number under Admin, Property details in Google Analytics. Leave empty until the app is connected."
            error={errors.ga4PropertyId}
          />
          <TextField
            id="app-firebase"
            label="Firebase project ID"
            value={values.firebaseProjectId}
            onChange={(event) => setValue('firebaseProjectId', event.target.value)}
            error={errors.firebaseProjectId}
          />
          <TextField
            id="app-store"
            label="Play Store address"
            type="url"
            value={values.playStoreUrl}
            onChange={(event) => setValue('playStoreUrl', event.target.value)}
            hint="Starts with https://"
            error={errors.playStoreUrl}
          />
          <TextField
            id="app-icon"
            label="Icon address"
            type="url"
            value={values.iconUrl}
            onChange={(event) => setValue('iconUrl', event.target.value)}
            hint="Starts with https://. Without one, the app's first letter is shown."
            error={errors.iconUrl}
          />
        </div>

        {Object.keys(errors).length > 0 && (
          <Notice tone="danger">Fix the fields marked above, then save again.</Notice>
        )}
        {save.error && <Notice tone="danger">{save.error.message}</Notice>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {app ? 'Save changes' : 'Add app'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
