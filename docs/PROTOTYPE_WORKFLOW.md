# Prototype Development Workflow

**Version:** 1.0.0 | **Updated:** 2026-01-12

An iterative workflow for developing features from PRD to production, with built-in feedback loops.

---

## Quick Reference

| Stage | Purpose | Typical Duration |
|-------|---------|------------------|
| PRD | Define problem & requirements | 1-3 days |
| Spike | Validate technical feasibility | 1-2 days |
| Prototype | Build working proof of concept | 3-7 days |
| User Testing | Gather real user feedback | 1-3 days |
| Iterate | Refine based on feedback | Variable |
| Production | Ship production-ready code | Variable |

```
PRD → Spike → Prototype → User Testing → Iterate → Production
                              ↑______________|
                              (feedback loop)
```

---

## Stage 1: PRD

**Purpose:** Define the problem and requirements before building anything.

**Entry Criteria:**
- Identified problem or opportunity
- Initial stakeholder buy-in

**Activities:**
1. Create PRD from template (`./scripts/feature-init.sh "feature-name"`)
2. Define problem statement and goals
3. List requirements by priority (P0, P1, P2)
4. Identify open questions
5. Get stakeholder review and approval

**Exit Criteria:**
- [ ] PRD status is "Approved"
- [ ] All P0 requirements are clear and agreed
- [ ] Open questions resolved or deferred
- [ ] Notion page synced and up-to-date

**Notion Update:**
```bash
notion_cli prd update --id $PRD_ID --status "Approved" --stage "Spike"
```

See `docs/PRD_WORKFLOW.md` for detailed PRD guidance.

---

## Stage 2: Spike

**Purpose:** Validate technical feasibility before committing to build.

**Entry Criteria:**
- PRD approved
- Technical approach unclear or risky

**When to Skip:**
- Technical approach is well-understood
- Using familiar patterns/technologies
- Low technical risk

**Activities:**
1. Create spike document (`templates/SPIKE_TEMPLATE.md`)
2. Research key technical questions
3. Build minimal proof-of-concept (throwaway code OK)
4. Document findings and recommendations
5. Update PRD technical approach if needed

**Spike Document Structure:**
```markdown
# [Feature] Technical Spike

**Date:** YYYY-MM-DD
**Duration:** X hours/days
**PRD:** [Link]

## Questions to Answer
1. Can we achieve X with technology Y?
2. What's the performance impact of Z?

## Research & Experiments
### Question 1: [Description]
- Approach tried: ...
- Results: ...
- Conclusion: ...

## Recommendations
- Recommended approach: ...
- Estimated effort: ...
- Risks identified: ...

## Code Artifacts
- `spike/feature-name/` - Experimental code (not for production)
```

**Exit Criteria:**
- [ ] Key technical questions answered
- [ ] Recommended approach documented
- [ ] Effort estimate refined
- [ ] PRD updated with technical findings

**Notion Update:**
```bash
notion_cli prd update --id $PRD_ID --stage "Prototype"
```

---

## Stage 3: Prototype

**Purpose:** Build a working proof of concept that demonstrates core functionality.

**Entry Criteria:**
- PRD approved
- Technical approach validated (or spike skipped)

**Prototype Principles:**
| Do | Don't |
|----|-------|
| Focus on P0 requirements only | Gold-plate or optimize early |
| Use real data structures | Write throwaway architecture |
| Make it demonstrable | Worry about edge cases |
| Keep code reasonably clean | Write comprehensive tests |

**Activities:**
1. Set up feature branch
2. Implement P0 requirements
3. Create basic happy-path tests
4. Deploy to staging/preview environment
5. Prepare demo for user testing

**Prototype Checklist:**
- [ ] Core functionality works end-to-end
- [ ] Can be demonstrated to users
- [ ] Deployed to accessible environment
- [ ] Known limitations documented

**Exit Criteria:**
- [ ] All P0 requirements implemented
- [ ] Working demo available
- [ ] Ready for user feedback

**Notion Update:**
```bash
notion_cli prd update --id $PRD_ID --stage "Testing"
```

---

## Stage 4: User Testing

**Purpose:** Gather real feedback from users before investing in production quality.

**Entry Criteria:**
- Working prototype deployed
- Test users identified

**Activities:**
1. Identify 3-5 test users (internal or external)
2. Prepare test scenarios
3. Conduct testing sessions (30-60 min each)
4. Document feedback using `templates/FEEDBACK_TEMPLATE.md`
5. Synthesize findings and prioritize issues

**Feedback Collection:**

```markdown
# User Testing Feedback

**Feature:** [Name]
**Date:** YYYY-MM-DD
**Tester:** [Name/Role]
**Session Duration:** X minutes

## Tasks Attempted
| Task | Success | Time | Notes |
|------|---------|------|-------|
| Create account | Yes | 45s | Confused by email format |
| Reset password | No | - | Couldn't find link |

## Usability Issues
| Issue | Severity | Quote/Observation |
|-------|----------|-------------------|
| Email validation unclear | Medium | "I didn't know what format to use" |
| Reset link hard to find | High | User gave up after 2 minutes |

## Feature Requests
- "Would be nice to log in with Google"
- "Can I see my previous sessions?"

## Overall Impression
[Summary of user's overall sentiment]
```

**Feedback Synthesis:**

After collecting feedback from all testers:

```markdown
# Feedback Synthesis

## Critical Issues (Must Fix)
- Issue 1: [X/Y testers encountered this]
- Issue 2: [X/Y testers encountered this]

## Important Issues (Should Fix)
- Issue 3: [Details]

## Nice to Have (Consider for Future)
- Request 1: [Details]

## Validation
- Hypothesis confirmed: [What worked well]
- Hypothesis invalidated: [What didn't work]
```

**Exit Criteria:**
- [ ] Feedback collected from 3+ users
- [ ] Issues prioritized by severity
- [ ] Decision made: iterate, pivot, or proceed

**Notion Update:**
```bash
notion_cli prd update --id $PRD_ID --stage "Iterate"
```

---

## Stage 5: Iterate

**Purpose:** Refine the prototype based on user feedback.

**Entry Criteria:**
- User testing complete
- Prioritized list of issues

**Decision Framework:**

| Feedback Type | Action |
|---------------|--------|
| Critical usability issue | Must fix before production |
| Validates core assumption | Proceed with confidence |
| Invalidates core assumption | Consider pivot or PRD revision |
| Feature request (in scope) | Add to P1/P2 if time permits |
| Feature request (out of scope) | Document for future PRD |

**Iteration Cycle:**
```
Fix Issues → Quick Test → More Feedback? → Fix Issues → ...
                              ↓
                         Satisfied → Production
```

**Activities:**
1. Address critical issues first
2. Quick validation with 1-2 testers
3. Repeat if significant issues remain
4. Update PRD with learnings

**When to Stop Iterating:**
- Critical issues resolved
- Users can complete core tasks
- Diminishing returns on changes
- Deadline pressure (document remaining issues)

**Exit Criteria:**
- [ ] Critical issues resolved
- [ ] Core user journey works smoothly
- [ ] Remaining issues documented as tech debt

**Notion Update:**
```bash
notion_cli prd update --id $PRD_ID --stage "Production"
```

---

## Stage 6: Production

**Purpose:** Prepare and ship production-ready code.

**Entry Criteria:**
- Prototype validated through user testing
- Critical issues resolved

**Production Checklist:**

### Code Quality
- [ ] Code review completed
- [ ] Follows project conventions
- [ ] No obvious security issues
- [ ] Error handling in place

### Testing
- [ ] Unit tests for core logic
- [ ] Integration tests for happy path
- [ ] Manual QA pass
- [ ] Performance acceptable

### Documentation
- [ ] README/docs updated
- [ ] API documentation (if applicable)
- [ ] Changelog entry

### Deployment
- [ ] Feature flags configured (if applicable)
- [ ] Rollback plan documented
- [ ] Monitoring/alerts set up
- [ ] Deployed to production

### Communication
- [ ] Release notes prepared
- [ ] Stakeholders notified
- [ ] Support team briefed (if needed)

**Exit Criteria:**
- [ ] Feature live in production
- [ ] No critical bugs in first 24-48 hours
- [ ] PRD marked complete

**Notion Update:**
```bash
notion_cli prd update --id $PRD_ID --status "Complete" --stage "Production"
```

---

## Workflow Commands

### Initialize New Feature
```bash
# Create PRD and set up tracking
./scripts/feature-init.sh "feature-name"
```

### Update Stage in Notion
```bash
# Move through stages
notion_cli prd update --id $PRD_ID --stage "Spike"
notion_cli prd update --id $PRD_ID --stage "Prototype"
notion_cli prd update --id $PRD_ID --stage "Testing"
notion_cli prd update --id $PRD_ID --stage "Iterate"
notion_cli prd update --id $PRD_ID --stage "Production"
```

### Generate Progress Report
```bash
# Show current stage and blockers
./scripts/feature-report.sh "feature-name"
```

---

## Stage Transitions

| From | To | Trigger |
|------|-----|---------|
| PRD | Spike | PRD approved, technical uncertainty |
| PRD | Prototype | PRD approved, approach clear |
| Spike | Prototype | Feasibility confirmed |
| Spike | PRD | Need to revise requirements |
| Prototype | Testing | P0 requirements working |
| Testing | Iterate | Feedback collected |
| Testing | Production | No critical issues |
| Iterate | Testing | Changes need validation |
| Iterate | Production | Issues resolved |
| Iterate | PRD | Major pivot needed |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Instead |
|--------------|---------|---------|
| Skipping PRD | Building wrong thing | Always define problem first |
| Skipping user testing | Assumptions untested | Test with 3+ real users |
| Premature optimization | Wasted effort | Optimize after validation |
| Endless iteration | Never shipping | Set iteration budget |
| Gold-plating prototype | Over-investment | Focus on P0 only |
| Ignoring feedback | Building for yourself | Address critical issues |

---

## Tool Selection by Stage

| Stage | Recommended Tools |
|-------|-------------------|
| PRD | Claude (reasoning), Notion (tracking) |
| Spike | Perplexity (research), Ollama (local experiments) |
| Prototype | Claude/OpenCode (coding), Claude Canvas (demos) |
| Testing | Claude Canvas (feedback capture), Notion (synthesis) |
| Iterate | Claude/OpenCode (fixes), Gateway (if testing APIs) |
| Production | OpenCode (refactoring), Gateway (monitoring) |

---

## Example Timeline

**Small Feature (1-2 weeks):**
| Stage | Days |
|-------|------|
| PRD | 1 |
| Spike | 0 (skipped) |
| Prototype | 3-4 |
| Testing | 1-2 |
| Iterate | 1-2 |
| Production | 1-2 |

**Medium Feature (3-4 weeks):**
| Stage | Days |
|-------|------|
| PRD | 2-3 |
| Spike | 1-2 |
| Prototype | 5-7 |
| Testing | 2-3 |
| Iterate | 3-5 |
| Production | 3-5 |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `PRD_WORKFLOW.md` | Detailed PRD creation guide |
| `templates/PRD_TEMPLATE.md` | Blank PRD template |
| `templates/SPIKE_TEMPLATE.md` | Technical spike template |
| `templates/FEEDBACK_TEMPLATE.md` | User testing feedback form |
