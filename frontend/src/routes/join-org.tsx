import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import Button from "~/components/Button";
import Toast from "~/components/Toast";
import { routes } from "~/routes";
import { formatAbsoluteDate } from "~/utils/date.utils";
import DocumentListPage from "~/components/DocumentListPage";

interface DiscoverableOrg {
  id: number;
  name: string;
  slug: string;
}

interface MyRequest {
  id: number;
  organization_id: number;
  status: "pending" | "accepted" | "rejected";
  message: string | null;
  org_name: string;
  org_slug: string;
  created_at: string;
  updated_at: string;
}

export default function JoinOrgPage() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = createSignal<DiscoverableOrg[]>([]);
  const [myRequests, setMyRequests] = createSignal<MyRequest[]>([]);
  const [memberOrgIds, setMemberOrgIds] = createSignal<Set<number>>(new Set());
  const [loadingOrgs, setLoadingOrgs] = createSignal(true);
  const [joiningOrgId, setJoiningOrgId] = createSignal<number | null>(null);
  const [joinMessage, setJoinMessage] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  onMount(async () => {
    const isValid = await api.validateSession();
    if (!isValid) {
      navigate(routes.login);
      return;
    }
    loadData();
  });

  const loadData = async () => {
    setLoadingOrgs(true);
    try {
      const [orgsResult, requestsResult, membershipsResult] = await Promise.all(
        [
          api.listDiscoverableOrgs(),
          api.listMyJoinRequests(),
          api.getMyMemberships(),
        ],
      );
      setOrgs(orgsResult.organizations);
      setMyRequests(requestsResult.requests);
      setMemberOrgIds(new Set(membershipsResult.orgIds));
    } catch (err) {
      console.error("Failed to load join org data:", err);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const isMember = (orgId: number) => memberOrgIds().has(orgId);

  const getRequestForOrg = (orgId: number) =>
    myRequests().find(
      (r) => r.organization_id === orgId && r.status === "pending",
    );

  const handleSubmitRequest = async (orgId: number) => {
    setSubmitting(true);
    try {
      const result = await api.createJoinRequest(
        orgId,
        joinMessage() || undefined,
      );
      if (result.autoAccepted) {
        setToast({
          message: "You've been automatically added to the organization!",
          type: "success",
        });
      } else {
        setToast({
          message: "Join request sent! The admin will review it.",
          type: "info",
        });
      }
      setJoiningOrgId(null);
      setJoinMessage("");
      await loadData();
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to send request",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: number) => {
    try {
      await api.cancelJoinRequest(requestId);
      setToast({ message: "Join request cancelled", type: "info" });
      await loadData();
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to cancel request",
        type: "error",
      });
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      accepted: "bg-green-500/10 text-green-400 border-green-500/20",
      rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return styles[status] ?? styles.pending;
  };

  return (
    <DocumentListPage
      title="Join an Organization"
      onBack={() => navigate(routes.homepage)}
      loading={loadingOrgs()}
    >
      <div class="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Browse Organizations */}
        <section>
          <h2 class="text-base font-semibold text-body mb-4">
            Available Organizations
          </h2>

          <Show
            when={!loadingOrgs()}
            fallback={
              <div class="flex items-center justify-center py-16">
                <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-muted-body" />
              </div>
            }
          >
            <Show
              when={orgs().length > 0}
              fallback={
                <div class="text-center py-12 text-muted-body">
                  <div class="i-carbon-enterprise w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No organizations are currently discoverable.</p>
                </div>
              }
            >
              <div class="space-y-3">
                <For each={orgs()}>
                  {(org) => {
                    const existingRequest = () => getRequestForOrg(org.id);
                    const alreadyMember = () => isMember(org.id);
                    const isJoining = () => joiningOrgId() === org.id;

                    return (
                      <div class="p-4 bg-elevated border border-base  rounded-lg">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-sm font-semibold text-body">
                              {org.name}
                            </p>
                            <p class="text-xs text-muted-body">@{org.slug}</p>
                          </div>
                          <Show
                            when={!alreadyMember()}
                            fallback={
                              <span class="px-2 py-1 text-xs rounded-md border bg-green-500/10 text-green-400 border-green-500/20">
                                Member
                              </span>
                            }
                          >
                            <Show
                              when={!existingRequest()}
                              fallback={
                                <span
                                  class={`px-2 py-1 text-xs rounded-md border ${statusBadge(existingRequest()!.status)}`}
                                >
                                  Request pending
                                </span>
                              }
                            >
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setJoiningOrgId(org.id);
                                  setJoinMessage("");
                                }}
                              >
                                <div class="i-carbon-user-follow w-4 h-4 mr-1.5" />
                                Request to Join
                              </Button>
                            </Show>
                          </Show>
                        </div>

                        {/* Inline request form */}
                        <Show when={isJoining()}>
                          <div class="mt-4 pt-4 border-t border-subtle space-y-3">
                            <div>
                              <label class="block text-xs font-medium text-secondary-body mb-1">
                                Message to admin{" "}
                                <span class="text-muted-body font-normal">
                                  (optional)
                                </span>
                              </label>
                              <textarea
                                value={joinMessage()}
                                onInput={(e) =>
                                  setJoinMessage(e.currentTarget.value)
                                }
                                rows={2}
                                maxLength={500}
                                disabled={submitting()}
                                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body text-sm placeholder-muted-body focus:outline-none focus:border-neutral-500 resize-none disabled:opacity-50"
                                placeholder="Introduce yourself or explain why you'd like to join..."
                              />
                            </div>
                            <div class="flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={submitting()}
                                onClick={() => handleSubmitRequest(org.id)}
                              >
                                <Show when={submitting()}>
                                  <div class="i-carbon-circle-dash animate-spin w-4 h-4 mr-1.5" />
                                </Show>
                                {submitting() ? "Sending..." : "Send Request"}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={submitting()}
                                onClick={() => {
                                  setJoiningOrgId(null);
                                  setJoinMessage("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </section>

        {/* My Requests - only pending ones */}
        <Show when={myRequests().length > 0}>
          <section>
            <h2 class="text-base font-semibold text-body mb-4">My Requests</h2>
            <div class="space-y-2">
              <For each={myRequests()}>
                {(req) => (
                  <div class="flex items-center justify-between p-3 bg-elevated border border-base rounded-lg">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-body">
                        {req.org_name}
                      </p>
                      <p class="text-xs text-muted-body">
                        Requested {formatAbsoluteDate(req.created_at)}
                      </p>
                      <Show when={req.message}>
                        <p class="text-xs text-secondary-body italic mt-0.5">
                          "{req.message}"
                        </p>
                      </Show>
                    </div>
                    <div class="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span
                        class={`px-2 py-0.5 text-xs rounded-md border ${statusBadge(req.status)}`}
                      >
                        {req.status}
                      </span>
                      <Show when={req.status === "pending"}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCancel(req.id)}
                        >
                          Cancel
                        </Button>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>
      </div>

      <Show when={toast()}>
        <Toast
          message={toast()!.message}
          type={toast()!.type}
          onClose={() => setToast(null)}
        />
      </Show>
    </DocumentListPage>
  );
}
