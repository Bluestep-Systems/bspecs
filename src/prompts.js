import { text, password, confirm, isCancel, cancel } from '@clack/prompts';
import { existsSync } from 'fs';
import { join } from 'path';

function titleCase(s) {
  return s
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function bail(value) {
  if (isCancel(value)) {
    cancel('Cancelled.');
    process.exit(0);
  }
  return value;
}

export async function runPrompts() {
  const projectName = bail(
    await text({
      message: 'Project folder name',
      placeholder: 'my-bluestep-project',
      validate: (v) => {
        if (!v || !v.trim()) return 'Project name is required';
        if (/[<>:"/\\|?*]/.test(v)) return 'Invalid characters in name';
        if (existsSync(join(process.cwd(), v))) return `Folder "${v}" already exists`;
        return undefined;
      },
    })
  );

  const clientName = bail(
    await text({
      message: 'Client name',
      initialValue: titleCase(projectName),
      validate: (v) => (v && v.trim() ? undefined : 'Client name is required'),
    })
  );

  const projectDescription = bail(
    await text({
      message: 'Project description (you can paste from ClickUp)',
      placeholder: 'What does this project do? Min 20 characters.',
      validate: (v) => {
        if (!v || v.trim().length < 20) return 'Description must be at least 20 characters';
        return undefined;
      },
    })
  );

  const context7Key = bail(
    await password({
      message: 'Context7 API key (optional — press Enter to skip)',
      mask: '*',
    })
  );

  const initGit = bail(
    await confirm({
      message: 'Initialize a git repository?',
      initialValue: true,
    })
  );

  const proceed = bail(
    await confirm({
      message: `Create project "${projectName}" in ${process.cwd()}?`,
      initialValue: true,
    })
  );

  if (!proceed) return null;

  return {
    projectName,
    clientName,
    projectDescription,
    context7Key: context7Key || 'YOUR_CONTEXT7_API_KEY_HERE',
    initGit,
  };
}
