import { db } from '../lib/firebase';
import React from 'react';

import CountdownTimer from '../components/CountdownTimer';

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
  const apartmentsSnapshot = await db.collection('apartments').orderBy('discoveryTime', 'desc').limit(100).get();
  const applicationsSnapshot = await db.collection('applications').orderBy('updatedAt', 'desc').get();

  let apartments: any[] = apartmentsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    discoveryTime: doc.data().discoveryTime?.toDate()?.toISOString() || new Date().toISOString()
  }));
  
  // Filter for Amsterdam only (to hide extraneous results)
  apartments = apartments.filter(a => {
    const isAmsterdam = (a.address?.toLowerCase().includes('amsterdam') || a.type?.toLowerCase().includes('amsterdam'));
    return isAmsterdam;
  });

  const applications: any[] = applicationsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    appliedAt: doc.data().appliedAt?.toDate()?.toISOString() || new Date().toISOString(),
    updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString()
  }));

  const activeApps = applications.filter((app: any) => app.status === 'APPLIED').map((app: any) => {
    const apt = apartments.find(a => a.id === app.id);
    return { ...app, apartment: apt || null };
  });
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
            <p className="text-zinc-400 mt-1">Autonomous Housing Assistant (Amsterdam Only)</p>
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

        {/* Active Market (Available) */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-300">Available & Active Apartments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(() => {
              const displayedApartments = apartments.filter((a: any) => a.status === 'AVAILABLE' || activeApps.some((app: any) => app.id === a.id));
              
              // Sort so applied apartments are at the top
              displayedApartments.sort((a: any, b: any) => {
                const isAppliedA = activeApps.some((app: any) => app.id === a.id) ? 1 : 0;
                const isAppliedB = activeApps.some((app: any) => app.id === b.id) ? 1 : 0;
                return isAppliedB - isAppliedA;
              });

              if (displayedApartments.length === 0) {
                return (
                  <div className="col-span-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                    No active apartments found yet.
                  </div>
                );
              }

              return displayedApartments.map((apt: any) => {
                const isApplied = activeApps.some((app: any) => app.id === apt.id);
                return (
                  <a key={apt.id} href={`https://amsterdam.mijndak.nl/HuisDetails?PublicatieId=${apt.id}`} target="_blank" rel="noreferrer" className={`block bg-zinc-900 border ${isApplied ? 'border-emerald-500/50' : 'border-zinc-800'} rounded-xl overflow-hidden hover:bg-zinc-800/80 transition-all group flex flex-col sm:flex-row relative`}>
                    
                    {/* APPLIED Badge */}
                    {isApplied && (
                      <div className="absolute top-3 right-3 z-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-lg backdrop-blur-md">
                        Applied
                      </div>
                    )}

                    {/* Image */}
                    <div className="sm:w-1/3 h-48 sm:h-auto bg-zinc-800 relative flex-shrink-0">
                      {apt.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={apt.imageUrl} alt={apt.address} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-3xl">🏠</div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className={`text-lg font-bold pr-16 line-clamp-1 transition-colors ${isApplied ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-blue-400 group-hover:text-blue-300'}`}>
                          {apt.address || `#${apt.id}`}
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">{apt.type}</p>
                        
                        {apt.specs && (
                          <p className="text-sm text-zinc-500 mt-3 font-medium">
                            {apt.specs.replace(/\|/g, ' • ')}
                          </p>
                        )}
                      </div>
                      
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <div className="font-bold text-lg text-zinc-200">{apt.price || 'Prijs onbekend'}</div>
                          {apt.position && (
                            <div className="text-sm text-blue-400 mt-1">
                              Jouw voorlopige positie: <span className="font-medium">{apt.position} / {apt.totalCandidates}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Reageer tot</div>
                          <div className="text-sm text-zinc-300">
                            {apt.endDate ? <CountdownTimer endDateStr={apt.endDate} /> : 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              });
            })()}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-zinc-800">
          {/* Past/Cancelled Applications */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-300">Application History</h2>
            <div className="space-y-3">
              {pastApps.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                  No history yet.
                </div>
              ) : (
                pastApps.slice(0, 10).map((app: any) => {
                  const apt = apartments.find(a => a.id === app.id);
                  return (
                    <div key={app.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-zinc-300">{apt?.address || `Property #${app.id}`}</div>
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
                  );
                })
              )}
            </div>
          </section>

          {/* Unavailable/Historical Apartments */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-300">Expired / Unavailable</h2>
            <details className="group bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
              <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300 p-4 transition-colors font-medium flex items-center justify-between outline-none">
                <span>View Expired Apartments ({apartments.filter((a: any) => a.status !== 'AVAILABLE' && !activeApps.some((app: any) => app.id === a.id)).length})</span>
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-4 border-t border-zinc-800/50 max-h-[400px] overflow-y-auto space-y-3">
                {apartments.filter((a: any) => a.status !== 'AVAILABLE' && !activeApps.some((app: any) => app.id === a.id)).map((apt: any) => (
                  <div key={apt.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 opacity-70 flex flex-col justify-between">
                    <div>
                      <div className="text-sm font-bold text-zinc-300 line-clamp-1">{apt.address || `#${apt.id}`}</div>
                      <div className="text-xs text-zinc-500 mt-1">{apt.type}</div>
                    </div>
                    <div className="mt-3 flex justify-between items-end">
                       <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">Expired</span>
                       {apt.position && <span className="text-xs text-zinc-500">Rank: {apt.position}/{apt.totalCandidates}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
