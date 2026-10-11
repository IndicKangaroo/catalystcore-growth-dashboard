#!/usr/bin/env bash
# TEMPORARY diagnostic helper: runs a command and, on failure, copies its output into a
# GitHub annotation so it can be read without downloading logs. Remove once CI is green.
# usage: ci-annotate.sh <title> <command...>
title="$1"
shift
out=$("$@" 2>&1)
code=$?
printf '%s\n' "$out"
if [ "$code" -ne 0 ]; then
  msg=$(printf '%s' "$out" | sed 's/\x1b\[[0-9;]*m//g' | tail -c 3500 | sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g')
  echo "::error title=${title}::${msg}"
fi
exit "$code"
