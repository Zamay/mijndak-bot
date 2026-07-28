import { db } from '../lib/firebase';
import React from 'react';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function DashboardPage() {
  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-center space-y-4 p-8 bg-zinc-900 rounded-2xl border border-zinc-800">
          <h1 className="text-2xl font-bold text-red-500">Firebase Not Configured</h1>
          <p className="text-zinc-400 max-w-md">
            Please add <code className="bg-zinc-800 px-2 py-1 rounded">FIREBASE_SERVICE_ACCOUNT</code> to your Vercel Environment Variables containing the JSON from your serviceAccountKey.json file.
          </p>
        </div>
      </div>
    );
  }

  // Fetch data
  const apartmentsSnapshot = await db.collection('apartments').orderBy('discoveryTime', 'desc').limit(20).get();
  const applicationsSnapshot = await db.collection('applications').orderBy('updatedAt', 'desc').get();

  const apartments = apartmentsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    discoveryTime: doc.data().discoveryTime?.toDate()?.toISOString() || new Date().toISOString()
  }));

  const applications = applicationsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    appliedAt: doc.data().appliedAt?.toDate()?.toISOString() || new Date().toISOString(),
    updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString()
  }));

  const activeApps = applications.filter((app: any) => app.status === 'APPLIED');
  const pastApps = applications.filter((app: any) => app.status !== 'APPLIED');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              MijnDak Dashboard
            </h1>
            <p className="text-zinc-400 mt-1">Autonomous Housing Assistant</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 flex flex-col items-center">
              <span className="text-xs text-zinc-500 uppercase font-semibold">Active Apps</span>
              <span className="text-xl font-bold text-emerald-400">{activeApps.length} / 2</span>
            </div>
            <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 flex flex-col items-center">
              <span className="text-xs text-zinc-500 uppercase font-semibold">Total Tracked</span>
              <span className="text-xl font-bold text-cyan-400">{apartments.length}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Applications */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Active Applications
            </h2>
            <div className="space-y-3">
              {activeApps.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                  No active applications right now.
                </div>
              ) : (
                activeApps.map((app: any) => (
                  <div key={app.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <a href={`https://amsterdam.mijndak.nl/HuisDetails?PublicatieId=${app.id}`} target="_blank" rel="noreferrer" className="text-lg font-medium text-white hover:text-emerald-400 transition-colors">
                        Property #{app.id}
                      </a>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {app.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800/50">
                        <div className="text-xs text-zinc-500 mb-1">Queue Position</div>
                        <div className="text-xl font-semibold text-white">
                          {app.position === 999 ? '?' : app.position} <span className="text-sm text-zinc-500 font-normal">/ {app.totalCandidates === 999 ? '?' : app.totalCandidates}</span>
                        </div>
                      </div>
                      <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800/50">
                        <div className="text-xs text-zinc-500 mb-1">Last Updated</div>
                        <div className="text-sm font-medium text-zinc-300">
                          {new Date(app.updatedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Past/Cancelled Applications */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-300">Application History</h2>
            <div className="space-y-3">
              {pastApps.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                  No history yet.
                </div>
              ) : (
                pastApps.slice(0, 5).map((app: any) => (
                  <div key={app.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-300">Property #{app.id}</div>
                      <div className="text-xs text-zinc-500 mt-1">{new Date(app.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      app.status === 'CANCELLED' ? 'bg-amber-500/10 text-amber-500' : 
                      app.status === 'SELECTED' ? 'bg-emerald-500/10 text-emerald-500' : 
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Recently Discovered Apartments */}
        <section className="space-y-4 pt-4 border-t border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-300">Recently Discovered Apartments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apartments.length === 0 ? (
              <div className="col-span-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                No apartments found yet. The bot will find them on its next run.
              </div>
            ) : (
              apartments.map((apt: any) => (
                <a key={apt.id} href={`https://amsterdam.mijndak.nl/HuisDetails?PublicatieId=${apt.id}`} target="_blank" rel="noreferrer" className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/80 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-white truncate pr-4">#{apt.id}</span>
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${apt.status === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Discovered: {new Date(apt.discoveryTime).toLocaleString()}
                  </div>
                </a>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
