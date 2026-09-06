# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.1] - 2026-09-06

### Fixed

- Fixed mojibake (double-encoded UTF-8) characters in `index.html` that rendered as garbled text (`â€"`, `Â·`, `âŒ˜`) instead of the intended `—`, `·`, and `⌘` symbols in the meta description, title, hero copy, empty-state hints, footer, and the keyboard shortcuts table.
