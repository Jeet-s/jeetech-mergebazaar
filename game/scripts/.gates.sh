#!/bin/zsh
# solve → validate → playtest (→ .agf/playtest.json) → docs → levels report summary
cd "$(dirname $0)/.."
[ -n "$NOSOLVE" ] || npx tsx scripts/tune-levels.ts solve > /tmp/mb-solve.log 2>&1 || { echo SOLVE FAIL; tail -3 /tmp/mb-solve.log; }
npm run validate > /tmp/mb-val.log 2>&1; echo "validate exit $?"; grep PROBLEM /tmp/mb-val.log; grep "early mean" /tmp/mb-val.log
npm run playtest 2>/dev/null | tail -1 > /tmp/mb-play.json && cp /tmp/mb-play.json .agf/playtest.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/mb-play.json'))
c=d['personas']['casual'];k=d['personas']['skilled'];N=len(c);t=N//3
m=lambda a:sum(a)/len(a)
print('dups',d['duplicates'],'L1-3',c[:3],'mid',round(m(c[t:N-t]),3),'late',round(m(c[-t:]),4),'lateK',round(m(k[-t:]),3))
run=0;bad=[]
for i,v in enumerate(c):
    run = run+1 if i>=5 and v>=0.9 else 0
    if run>2: bad.append(i+1)
print('easy runs',bad,'share',round(sum(1 for v in c[5:] if v>=0.9)/(N-5),3),'spikes',[i+1 for i in range(3,N) if m(c[i-3:i])-c[i]>0.35],'walls',[i+1 for i in range(N) if c[i]<0.1 and k[i]<0.6])
def rank(a):
    o=sorted(range(len(a)),key=lambda i:a[i]); r=[0]*len(a)
    for j,i in enumerate(o): r[i]=j
    return r
ry=rank(c); print('rho',round(1-6*sum((i-ry[i])**2 for i in range(N))/(N*(N*N-1)),3))
PY
npx tsx scripts/levels-doc.ts
start=$(date +%s); npm run levels 2>/dev/null | tail -1 > /tmp/mb-levels.json; echo "levels report $(( $(date +%s) - start ))s"
python3 -c "
import json;d=json.load(open('/tmp/mb-levels.json'))
print('max explored',max(l['explored'] for l in d['levels']))
for l in d['levels']:
  if l['explored']>12000 or l['optimal'] is None or (l['trap'] or 0)>0.2: print('  L',l['n'],'opt',l['optimal'],'expl',l['explored'],'trap',l['trap'])"
