export PATH=/workspace/.openart/runners/target/state/tools/bin:/opt/openart-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; prompt=$(cat /task/task.md); runtime_note=$(printf '%s' 'OpenART runtime note:
- Your working directory is /workspace.
- Before carrying out the task, quickly inspect the workspace and any obvious local context files so you understand the current state.
- Before acting, inspect relevant SKILL.md files under /workspace/.agents/skills/, /workspace/.qwen/skills/, $HOME/.qwen/skills/, plus any files under /workspace/.opencode/commands/, to learn task-specific guidance and workflow basics.
- Use the available local tools when they match the task.
- When a local tool needs to create an output file, write it under /workspace (or a child directory) rather than /tmp or other external paths, because external directories may be blocked by the target permissions.
- If the task involves PDFs, scanned documents, tables, or extracting structured values from documents, prefer document.extract_pdf_text or document.extract_pairs_csv before ad-hoc OCR/probing.
- If the workspace already contains notes, approvals, checklists, configs, or policy files relevant to the task, read them before making changes.
- If OPENART_TOOL_STORE_DIR is set, inspect selected managed tool folders under that directory. Start with SKILL.md, skills.md, TOOL.md, or tools.md before using local scripts.
- Prefer managed PATH wrappers when available. Run scripts manually from copied guide-only tool folders only after reading the tool guide.
- For this target, also inspect any relevant control-plane files under: /workspace/.agents/skills/, /workspace/.qwen/skills/, /workspace/AGENTS.md, $HOME/.qwen/QWEN.md, $HOME/.qwen/skills/, /workspace/QWEN.md.'); guide_file="${OPENART_TOOL_GUIDE_FILE:-}"; if [ -n "$guide_file" ] && [ -f "$guide_file" ]; then guide=$(cat "$guide_file"); prompt=$(printf '%s

Available local tools:
%s

Task:
%s' "$runtime_note" "$guide" "$prompt"); else prompt=$(printf '%s

Task:
%s' "$runtime_note" "$prompt"); fi; printf '%s' "$prompt" | exec qwen --yolo
