/-!
# SABOROU U-V3-01 MCP transport/auth adapter formal verification

This Lean 4 file formalizes the core safety properties from:

- `domain-entities.md`
- `business-rules.md`
- `business-logic-model.md`

Scope:

1. IAM role evidence alone never resolves to a SABOROU user id.
2. Tool dispatch is impossible before identity resolution.
3. Cross-user resource access is rejected.
4. Side-effect tools require explicit human approval.
5. Safe audit events do not depend on raw secrets or raw tool arguments.

This is a mathematical model of the U-V3-01 logic, not a proof that every
TypeScript line is bug-free.
-/

namespace Saborou
namespace UV3_01

abbrev UserId := Nat
abbrev RequestId := Nat
abbrev ToolName := Nat
abbrev Secret := Nat
abbrev RawArgs := Nat

inductive AuthEvidence where
  | cognitoJwt (userId : UserId)
  | gatewayIamRole
  | invalid
  deriving DecidableEq, Repr

inductive Source where
  | agentcore
  | extensionFallback
  deriving DecidableEq, Repr

inductive SideEffect where
  | read
  | write
  | externalPost
  deriving DecidableEq, Repr

inductive AdapterError where
  | unauthorized
  | forbidden
  | validationError
  | toolNotAllowed
  deriving DecidableEq, Repr

inductive Status where
  | success
  | validationError
  | unauthorized
  | forbidden
  | toolError
  deriving DecidableEq, Repr

structure ToolDef where
  name : ToolName
  sideEffect : SideEffect
  requiresHumanApproval : Bool
  deriving DecidableEq, Repr

structure McpRequest where
  requestId : RequestId
  toolName : ToolName
  auth : AuthEvidence
  source : Source
  humanApproved : Bool
  rawArgs : RawArgs
  secret : Secret
  deriving DecidableEq, Repr

structure McpToolContext where
  userId : UserId
  requestId : RequestId
  source : Source
  humanApproved : Bool
  deriving DecidableEq, Repr

structure UserResource where
  ownerId : UserId
  resourceId : Nat
  deriving DecidableEq, Repr

structure SafeAuditEvent where
  requestId : RequestId
  toolName : ToolName
  userIdHash : Nat
  source : Source
  status : Status
  durationMs : Nat
  deriving DecidableEq, Repr

def resolveIdentity : AuthEvidence → Option UserId
  | .cognitoJwt userId => some userId
  | .gatewayIamRole => none
  | .invalid => none

def toolAllowed (toolName : ToolName) (allowlist : List ToolDef) : Bool :=
  allowlist.any (fun tool => tool.name == toolName)

def findTool (toolName : ToolName) (allowlist : List ToolDef) : Option ToolDef :=
  allowlist.find? (fun tool => tool.name == toolName)

def requiresApproval (tool : ToolDef) : Bool :=
  match tool.sideEffect with
  | .read => false
  | .write => true
  | .externalPost => true

def approvalSatisfied (tool : ToolDef) (humanApproved : Bool) : Bool :=
  if requiresApproval tool then humanApproved else true

def buildContext (req : McpRequest) : Except AdapterError McpToolContext :=
  match resolveIdentity req.auth with
  | none => .error .unauthorized
  | some userId =>
      .ok {
        userId := userId
        requestId := req.requestId
        source := req.source
        humanApproved := req.humanApproved
      }

def canAccessResource (ctx : McpToolContext) (resource : UserResource) : Bool :=
  ctx.userId == resource.ownerId

def precheck (req : McpRequest) (allowlist : List ToolDef) : Except AdapterError McpToolContext :=
  match buildContext req with
  | .error e => .error e
  | .ok ctx =>
      match findTool req.toolName allowlist with
      | none => .error .toolNotAllowed
      | some tool =>
          if approvalSatisfied tool req.humanApproved then .ok ctx
          else .error .forbidden

def hashUserId (userId : UserId) : Nat :=
  userId + 1000

def safeAudit (req : McpRequest) (status : Status) (durationMs : Nat) : SafeAuditEvent :=
  let userIdHash :=
    match resolveIdentity req.auth with
    | some userId => hashUserId userId
    | none => 0
  {
    requestId := req.requestId
    toolName := req.toolName
    userIdHash := userIdHash
    source := req.source
    status := status
    durationMs := durationMs
  }

theorem iam_role_does_not_resolve_user :
    resolveIdentity .gatewayIamRole = none := by
  rfl

theorem invalid_auth_does_not_resolve_user :
    resolveIdentity .invalid = none := by
  rfl

theorem resolved_identity_is_cognito (evidence : AuthEvidence) (userId : UserId)
    (h : resolveIdentity evidence = some userId) :
    evidence = .cognitoJwt userId := by
  cases evidence with
  | cognitoJwt uid =>
      simp [resolveIdentity] at h
      exact congrArg AuthEvidence.cognitoJwt h
  | gatewayIamRole =>
      simp [resolveIdentity] at h
  | invalid =>
      simp [resolveIdentity] at h

theorem build_context_rejects_iam_role (req : McpRequest)
    (h : req.auth = .gatewayIamRole) :
    buildContext req = .error .unauthorized := by
  cases req
  simp [buildContext, resolveIdentity] at h ⊢
  simp [h]

theorem precheck_rejects_iam_role (req : McpRequest) (allowlist : List ToolDef)
    (h : req.auth = .gatewayIamRole) :
    precheck req allowlist = .error .unauthorized := by
  cases req
  simp [precheck, buildContext, resolveIdentity] at h ⊢
  simp [h]

theorem precheck_without_identity_is_not_ok (req : McpRequest) (allowlist : List ToolDef)
    (h : resolveIdentity req.auth = none) :
    ∃ err, precheck req allowlist = .error err := by
  cases req
  simp [precheck, buildContext] at h ⊢
  simp [h]

theorem no_cross_user_access (ctx : McpToolContext) (resource : UserResource)
    (h : ctx.userId ≠ resource.ownerId) :
    canAccessResource ctx resource = false := by
  simp [canAccessResource]
  exact h

theorem owner_can_access (ctx : McpToolContext) (resource : UserResource)
    (h : ctx.userId = resource.ownerId) :
    canAccessResource ctx resource = true := by
  simp [canAccessResource]
  exact h

theorem write_requires_approval :
    requiresApproval { name := 1, sideEffect := .write, requiresHumanApproval := true } = true := by
  rfl

theorem external_post_requires_approval :
    requiresApproval { name := 1, sideEffect := .externalPost, requiresHumanApproval := true } = true := by
  rfl

theorem read_does_not_require_approval :
    requiresApproval { name := 1, sideEffect := .read, requiresHumanApproval := false } = false := by
  rfl

theorem side_effect_without_approval_rejected (req : McpRequest) (toolName : ToolName)
    (side : SideEffect)
    (hside : side = .write ∨ side = .externalPost)
    (hauth : req.auth = .cognitoJwt 42)
    (hname : req.toolName = toolName)
    (happroval : req.humanApproved = false) :
    precheck req [{ name := toolName, sideEffect := side, requiresHumanApproval := true }] =
      .error .forbidden := by
  cases hside with
  | inl hwrite =>
      cases req
      simp [precheck, buildContext, resolveIdentity, findTool, approvalSatisfied,
        requiresApproval] at hauth hname happroval ⊢
      simp [hauth, hname, happroval, hwrite]
  | inr hexternal =>
      cases req
      simp [precheck, buildContext, resolveIdentity, findTool, approvalSatisfied,
        requiresApproval] at hauth hname happroval ⊢
      simp [hauth, hname, happroval, hexternal]

theorem read_tool_with_identity_precheck_ok (req : McpRequest) (toolName : ToolName)
    (hauth : req.auth = .cognitoJwt 42)
    (hname : req.toolName = toolName) :
    ∃ ctx,
      precheck req [{ name := toolName, sideEffect := .read, requiresHumanApproval := false }] =
        .ok ctx ∧ ctx.userId = 42 := by
  cases req
  simp [precheck, buildContext, resolveIdentity, findTool, approvalSatisfied,
    requiresApproval] at hauth hname ⊢
  simp [hauth, hname]

theorem audit_independent_of_secret_and_args (req₁ req₂ : McpRequest)
    (hRequestId : req₁.requestId = req₂.requestId)
    (hToolName : req₁.toolName = req₂.toolName)
    (hAuth : req₁.auth = req₂.auth)
    (hSource : req₁.source = req₂.source)
    (status : Status)
    (durationMs : Nat) :
    safeAudit req₁ status durationMs = safeAudit req₂ status durationMs := by
  cases req₁
  cases req₂
  simp [safeAudit] at hRequestId hToolName hAuth hSource ⊢
  simp [hRequestId, hToolName, hAuth, hSource]

theorem audit_for_iam_has_no_user_hash (req : McpRequest)
    (h : req.auth = .gatewayIamRole) (status : Status) (durationMs : Nat) :
    (safeAudit req status durationMs).userIdHash = 0 := by
  cases req
  simp [safeAudit, resolveIdentity] at h ⊢
  simp [h]

#check iam_role_does_not_resolve_user
#check resolved_identity_is_cognito
#check precheck_rejects_iam_role
#check no_cross_user_access
#check side_effect_without_approval_rejected
#check audit_independent_of_secret_and_args

end UV3_01
end Saborou
