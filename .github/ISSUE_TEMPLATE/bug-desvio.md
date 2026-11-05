---
name: Bug ou desvio
about: Erro, bug, teste instável ou incoerência encontrado durante outra tarefa (AGENTS.md §14)
title: "fix(<escopo>): <descrição objetiva em português>"
labels: ["bug", "desvio"]
---

<!--
Labels obrigatórias (AGENTS.md §14):
- tipo: bug | enhancement | documentation
- origem: desvio (quando encontrado durante outra tarefa)
- área: area:desktop | area:web | area:backend | area:types | area:ci | area:spec-kit
- bloqueante: somente se impediu a tarefa em andamento
Antes de abrir, procure duplicatas: gh issue list --search "<termo>"
-->

## Problema

<!-- Comportamento atual × comportamento esperado. -->

## Onde foi encontrado

- **Feature / tarefa:** <!-- ex: 008/T801 ou "fora de feature" -->
- **Branch / commit:** <!-- ex: fix/dev-redireciona-web @ e97b8ee -->

## Como reproduzir

1. 

## Evidência

<!-- Log, saída de teste, `arquivo:linha`. -->

## Causa provável

<!-- Somente o que foi verificado. Se não verificado, escreva "não investigada". -->

## Impacto na tarefa atual

- [ ] **Bloqueante** — impede cumprir ou verificar a tarefa; a tarefa foi interrompida.
- [ ] **Não bloqueante** — a tarefa seguiu; correção fica para tarefa própria.

Justificativa:

## Correção sugerida e critérios de aceite

- [ ] 

## Requisitos afetados

<!-- ex: RF-801, RNF-701, RN-04, ou "nenhum identificado". -->
