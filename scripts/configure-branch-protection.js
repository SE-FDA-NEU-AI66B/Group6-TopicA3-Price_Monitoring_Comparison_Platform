import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflowPath = fileURLToPath(
  new URL('../.github/workflows/ci.yml', import.meta.url),
);

export const REPOSITORY_SLUG =
  process.env.GITHUB_REPOSITORY?.trim()
  || 'SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform';

export const PROTECTED_BRANCH = 'main';
export const REQUIRED_CI_CHECK_CONTEXT = 'Install, Build & Test';

export const BRANCH_PROTECTION_PAYLOAD = Object.freeze({
  required_status_checks: {
    strict: true,
    contexts: [REQUIRED_CI_CHECK_CONTEXT],
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: 1,
  },
  restrictions: null,
});

export function verifyCiAndDeploymentWorkflow(yamlText) {
  assert.match(yamlText, /push:\s*\r?\n\s*branches:\s*\r?\n\s*-\s*main/);
  assert.match(yamlText, /pull_request:\s*\r?\n\s*branches:\s*\r?\n\s*-\s*main/);
  assert.match(yamlText, /test:\s*\r?\n\s*name:\s*Install, Build & Test/);
  assert.match(yamlText, /deploy:\s*\r?\n\s*name:\s*Deploy to Production/);
  assert.match(yamlText, /needs:\s*test/);
  assert.match(
    yamlText,
    /if:\s*github\.event_name\s*==\s*'push'\s*&&\s*github\.ref\s*==\s*'refs\/heads\/main'/,
  );
  assert.match(yamlText, /\$\{\{\s*secrets\.RENDER_DEPLOY_HOOK_URL\s*\}\}/);
  assert.doesNotMatch(yamlText, /https:\/\/api\.render\.com\/deploy\/srv-[A-Za-z0-9]+/);
}

function applyBranchProtection() {
  const endpoint = `repos/${REPOSITORY_SLUG}/branches/${PROTECTED_BRANCH}/protection`;
  const output = execFileSync(
    'gh',
    ['api', '--method', 'PUT', endpoint, '--input', '-'],
    {
      input: JSON.stringify(BRANCH_PROTECTION_PAYLOAD),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  const response = JSON.parse(output);
  assert.deepEqual(
    response.required_status_checks?.contexts,
    [REQUIRED_CI_CHECK_CONTEXT],
  );
  assert.equal(
    response.required_pull_request_reviews?.required_approving_review_count,
    1,
  );
  console.log(`✔ Applied branch protection on ${REPOSITORY_SLUG}:${PROTECTED_BRANCH}`);
}

const yamlText = readFileSync(workflowPath, 'utf8');
verifyCiAndDeploymentWorkflow(yamlText);
console.log('✔ Verified .github/workflows/ci.yml test and main-only gated deploy jobs');
console.log(
  `✔ Verified branch protection policy (PR required, >=1 approval, required status check: "${REQUIRED_CI_CHECK_CONTEXT}")`,
);

if (process.argv.includes('--apply')) {
  applyBranchProtection();
}

