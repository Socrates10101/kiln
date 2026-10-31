import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kilnRoot = path.resolve(__dirname, '..');

/**
 * Install Kiln into the host project:
 * - .claude/skills/ ← symlinks to kiln/skills/
 * - .kiln/          ← working directory (variants, agents)
 */
export async function install(projectRoot: string): Promise<void> {
  console.log('');
  installSkills(projectRoot);
  installWorkDir(projectRoot);
  console.log('Done.');
}

// ── Skills ───────────────────────────────────────────────────────────

function installSkills(projectRoot: string): void {
  const kilnSkillsDir = path.join(kilnRoot, 'skills');
  const targetDir = path.join(projectRoot, '.claude', 'skills');

  console.log('Skills:');

  if (!fs.existsSync(kilnSkillsDir)) {
    console.log('  (no skills to install)');
    console.log('');
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const skills = fs.readdirSync(kilnSkillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  if (skills.length === 0) {
    console.log('  (no skills found)');
    console.log('');
    return;
  }

  for (const skill of skills) {
    const source = path.join(kilnSkillsDir, skill.name);
    const target = path.join(targetDir, skill.name);
    const relative = path.relative(targetDir, source);

    if (fs.existsSync(target)) {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {
        const existing = fs.readlinkSync(target);
        if (existing === relative) {
          console.log(`  \u2713 ${skill.name}`);
          continue;
        }
        fs.unlinkSync(target);
      } else {
        console.log(`  \u26A0 ${skill.name} \u2014 skipped (not a symlink)`);
        continue;
      }
    }

    fs.symlinkSync(relative, target);
    console.log(`  \u2192 ${skill.name}`);
  }

  console.log('');
}

// ── Working Directory ────────────────────────────────────────────────

function installWorkDir(projectRoot: string): void {
  const kilnDir = path.join(projectRoot, '.kiln');

  console.log('Working directory:');

  // .kiln/
  ensureDir(kilnDir);

  // .kiln/variants/
  ensureDir(path.join(kilnDir, 'variants'));

  // .kiln/agents/
  ensureDir(path.join(kilnDir, 'agents'));

  // .kiln/.gitignore — agents/ is a transient communication channel, keep it out of git
  const gitignorePath = path.join(kilnDir, '.gitignore');
  const gitignoreContent = 'agents/\n';

  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, 'utf-8');
    if (existing === gitignoreContent) {
      console.log(`  \u2713 .gitignore`);
    } else {
      console.log(`  \u26A0 .gitignore \u2014 already exists, not overwriting`);
    }
  } else {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log(`  \u2192 .gitignore`);
  }

  console.log('');
}

function ensureDir(dir: string): void {
  const name = path.basename(dir) + '/';
  if (fs.existsSync(dir)) {
    console.log(`  \u2713 ${name}`);
  } else {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  \u2192 ${name}`);
  }
}
