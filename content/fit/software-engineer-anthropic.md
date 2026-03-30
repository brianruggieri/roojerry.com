---
title: Software Engineer, Claude Code
company: Anthropic
slug: software-engineer-anthropic
description: Evidence-backed fit assessment for Software Engineer, Claude Code at Anthropic
date: '2026-03-21'
public: false
cal_link: https://cal.com/brianruggieri/30min
posting_url: https://www.linkedin.com/jobs/view/4370000466/
repo_url: https://github.com/brianruggieri/candidate-eval
email: brian@roojerry.com
resume_pdf: /docs/resume.pdf
benchmark_postings: 61
company_research_summary: >
  Anthropic is a safety-focused AI lab building Claude as a research and commercial product.
  The Claude Code team ships developer-facing tooling — extensions, agents, and CLI integrations —
  that let engineers use Claude natively in their workflow. The team values strong taste for DX,
  deep LLM fluency, and the ability to reason about safety tradeoffs at the product layer.
overall_grade: A
overall_score: 0.93
should_apply: strong_yes
overall_summary: 'Overall A fit for Software Engineer, Claude Code at Anthropic. 9/9 must-haves met. Strongest dimension:
  Experience (A+). Weakest dimension: Education (A). This is a strong fit worth pursuing.'
skill_matches:
- skill: Experience with advanced LLM features like tool-use, chaining and orchestration patterns, and prompt engineering
  status: exceeds
  priority: must_have
  depth: expert
  sessions: 853
  source: repo_inspectable
  tier: inspectable
  discovery: false
- skill: Expert in React development, including performance optimization, modern patterns (hooks, context, suspense), and component architecture
  status: exceeds
  priority: must_have
  depth: advanced
  sessions: 120
  source: repo_inspectable
  tier: inspectable
  discovery: false
- skill: Hands-on experience working with large language models and prompt engineering
  status: exceeds
  priority: must_have
  depth: expert
  sessions: 853
  source: repo_inspectable
  tier: inspectable
  discovery: false
- skill: Passion for developer tools with extensive knowledge of diverse programming environments and languages
  status: exceeds
  priority: must_have
  depth: advanced
  sessions: 231
  source: repo_inspectable
  tier: inspectable
  discovery: true
- skill: Experience building and maintaining dev tools
  status: exceeds
  priority: must_have
  depth: advanced
  sessions: 400
  source: repo_inspectable
  tier: inspectable
  discovery: false
- skill: Specialize in user experience engineering but are a capable full stack developer
  status: exceeds
  priority: must_have
  depth: advanced
  sessions: 300
  source: deployed_url
  tier: deployed
  discovery: false
- skill: 5+ years of work experience
  status: exceeds
  priority: must_have
  depth: expert
  sessions: 0
  source: resume_only
  tier: claimed
  discovery: false
- skill: At least a Bachelor's degree in a related field or equivalent experience
  status: strong_match
  priority: must_have
  depth: proficient
  sessions: 0
  source: resume_only
  tier: claimed
  discovery: false
- skill: Curiosity about AI research
  status: exceeds
  priority: must_have
  depth: advanced
  sessions: 120
  source: repo_inspectable
  tier: inspectable
  discovery: true
- skill: Experience on projects with stringent safety, security and/or compliance requirements
  status: no_evidence
  priority: strong_preference
  depth: Unknown
  sessions: 0
  source: resume_only
  tier: claimed
  discovery: false
dimension_scores:
- dimension: Technical Skills
  grade: A+
  score: 0.97
  summary: Deep LLM expertise, React, Python, and dev tooling validated through 850+ session logs and inspectable repos.
- dimension: Experience
  grade: A+
  score: 0.95
  summary: 8+ years building production systems; two AI-native tools shipped in 2026 with measurable usage.
- dimension: Culture Fit
  grade: A
  score: 0.88
  summary: Strong alignment with Anthropic's DX-first values; evidence of safety-aware architectural decisions.
evidence_highlights:
- heading: Pipeline Architecture Decision
  quote: I designed the three-tier evidence model — inspectable, deployed, claimed — because resume claims without code proof are noise, not signal. The taxonomy-driven matcher surfaces gaps accurately enough that a recruiter can trust the grade without reading the code.
  project: candidate-eval
  date: March 2026
  tags:
  - Python
  - Pydantic
  - FastAPI
  - LLM
- heading: Claude Code Extension Integration
  quote: Building the session scanner required reverse-engineering JSONL structure from real Claude sessions — no public spec. The extractor now handles 850+ sessions with <2% parse error rate, and the output feeds directly into the scoring pipeline.
  project: claude-pane-pulse
  date: February 2026
  tags:
  - Chrome Extension
  - TypeScript
  - MV3
  - WebSockets
patterns:
- name: Architecture First
  strength: Established
  frequency: Dominant
- name: Iterative Refinement
  strength: Established
  frequency: Dominant
- name: Modular Thinking
  strength: Established
  frequency: Dominant
- name: Testing Instinct
  strength: Established
  frequency: Dominant
projects:
- name: candidate-eval
  description: Privacy-first pipeline that transforms Claude Code session logs and resumes into evidence-backed job fit assessments. Benchmarked against 61 real postings with 90%+ accuracy. Features a three-tier evidence model, taxonomy-driven skill matching, and a FastAPI server powering a Chrome extension.
  complexity: Ambitious
  repo_url: https://github.com/brianruggieri/candidate-eval
  technologies:
  - Python
  - FastAPI
  - Pydantic
  - SQLite
  - LLM
  - Pytest
  sessions: 853
  date_range: '2026'
  callout: 'Designed the evidence tier system so recruiters can distinguish verified code from resume claims at a glance — inspectable (green), deployed (blue), claimed (gray).'
- name: claude-pane-pulse
  description: Chrome MV3 extension that integrates with Claude Code's session JSONL output, enabling real-time skill extraction and assessment triggering from any job board. Handles session streaming with <2% parse error rate across 231 sessions.
  complexity: Ambitious
  repo_url: https://github.com/brianruggieri/claude-pane-pulse
  technologies:
  - TypeScript
  - Chrome MV3
  - WebSockets
  - FastAPI
  sessions: 231
  date_range: '2026'
  callout: ''
gaps:
- requirement: Experience on projects with stringent safety, security and/or compliance requirements
  status: No evidence found
  action: 'Address in cover letter: candidate-eval includes a PII scrubbing gate (DataFog + regex) before any output — mention this as a concrete safety layer example.'
---
