# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the MediKiosk project.

## What is an ADR?

An ADR records a decision that was made and why. Its primary value is the "Alternatives rejected"
section — without it, the next person re-does the analysis.

## How to create one

1. Copy `0000-template.md` to `NNNN-slug.md`, where NNNN is the next number.
2. Fill in all four sections. The "Alternatives rejected" section is mandatory.
3. Set status to `proposed`.
4. Open a PR. The ADR is `accepted` when the PR merges.

## When to create one

- A contract type is widened during a phase.
- A new external dependency is added (model, library, API).
- A technology choice is made (framework, language, deployment target).
- A security or compliance boundary is changed.
- An immutable rule from ARCHITECTURE.md is challenged.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| 0000 | Template | — | — |
