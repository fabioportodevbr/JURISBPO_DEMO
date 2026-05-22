# AGENTS.md

## Inicio de cada sessao

Antes de editar arquivos, confirme que esta trabalhando neste repositorio e sincronize a base local com o GitHub:

```bash
pwd
git status
git fetch origin
git pull --rebase origin main
```

Se `git status` mostrar alteracoes locais nao commitadas, nao sobrescreva nem descarte arquivos. Avalie a worktree antes do `pull --rebase`; quando for adequado, preserve as alteracoes com `git stash`, faca o rebase e aplique o stash novamente.

## Antes de commit e push

Antes de publicar qualquer alteracao:

```bash
git status
git fetch origin
git log --oneline HEAD..origin/main
git log --oneline origin/main..HEAD
```

Se o remoto estiver a frente, faca rebase antes do commit ou push:

```bash
git pull --rebase origin main
```

Nunca publique assumindo que esta copia local e a mais recente sem verificar a divergencia com `origin/main`.

## Protecao de alteracoes

- Nao reverta alteracoes locais que nao foram feitas por voce sem ordem expressa.
- Nao use comandos destrutivos como `git reset --hard` ou `git checkout --` sem autorizacao clara.
- Preserve o historico do trabalho feito em outros computadores ou por outros agentes.
- Se houver conflito entre alteracoes locais e remotas, resolva o conflito conscientemente antes de continuar.

## Segredos e arquivos locais

- Nunca rastreie nem publique arquivos `.env` reais.
- Mantenha apenas arquivos de exemplo, como `.env.example`, no Git.
- Nao cole chaves, senhas, tokens ou segredos em codigo, docs, logs de commit ou mensagens de pull request.
- Ao encontrar segredo rastreado ou historico suspeito, trate como incidente: remova do rastreamento, reforce o ignore/CI e avalie rotacao.

## Qualidade minima

- Leia o codigo existente antes de implementar.
- Prefira padroes e helpers ja usados no repositorio.
- Mantenha mudancas focadas no pedido.
- Verifique o que foi alterado antes de finalizar e registre testes ou limitacoes relevantes.
