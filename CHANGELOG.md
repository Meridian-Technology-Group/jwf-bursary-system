# Changelog

## [1.1.0](https://github.com/Meridian-Technology-Group/jwf-bursary-system/compare/v1.0.0...v1.1.0) (2026-05-24)


### Features

* **email:** INVITATION template mentions single-use + 30-day expiry ([#8](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/8)) ([#84](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/84)) ([05a29f4](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/05a29f4d27612c7fcefaea5f9a8d68e6e9f50ba7))


### Bug Fixes

* collapse duplicate set-outcome actions onto one shared core ([#11](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/11)) ([#79](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/79)) ([34fb0ef](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/34fb0ef3f54f6eb93d1f287a2f3594fd2e8b17f9))


### Refactors

* **invitations:** derive name from firstName/lastName, stop writing applicantName ([#9](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/9)a) ([#85](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/85)) ([ca006a1](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/ca006a18a9aeaa56ff64d4f05351b8c455909a50))
* **invitations:** drop legacy applicant_name column ([#9](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/9)b, step 2 of 2) ([#86](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/86)) ([f689aaa](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/f689aaa7deb75b189ecf528c624e0c06fd547da4))
* remove legacy app-level auth rate limiter ([#78](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/78)) ([642bfc7](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/642bfc7454105ab67c03b04072d44140b6c1a49c))


### Documentation

* backlog implementation plan + Resend/rate-limit doc corrections ([#75](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/75)) ([9375316](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/9375316b81f4e27ff4aa242ec1e5c5afbf5327e7))
* **backlog:** add automated versioning + in-app version display items ([#74](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/74)) ([5626a76](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/5626a765f0e527078c0659d6d8d8679f82d3f185))
* **backlog:** correct WAF mechanism + add CLI runbook; unblock [#13](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/13) ([#77](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/77)) ([9114a9b](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/9114a9bd1eb0a9bb8a970d67ac1008e587ebc40c))
* **backlog:** file parent-details required-upload hard-block bug ([#83](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/83)) ([5b02bba](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/5b02bbaad135b46954dfd1f80047e60644e0bcf0))
* reconcile applicant-form spec with shipped portal; correct synopsis framing ([#82](https://github.com/Meridian-Technology-Group/jwf-bursary-system/issues/82)) ([7545ae3](https://github.com/Meridian-Technology-Group/jwf-bursary-system/commit/7545ae3e43c0f9ab962dd16d6e1e9e4e81c953fd))
