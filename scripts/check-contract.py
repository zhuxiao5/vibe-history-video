#!/usr/bin/env python3
"""Check planned hook and text budgets. This is not visual acceptance."""
import argparse
import json
import math
from pathlib import Path


def check(cfg):
    fail=[]
    def positive(x):
        return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) and x>0
    width=cfg.get('width')
    readability=cfg.get('readability_contract',{})
    display=readability.get('display_width')
    if not positive(width) or not positive(display):
        return ['width and readability_contract.display_width must be positive']
    scale=display/width
    for key in ('critical_min_display_px','hook_min_display_px'):
        if not positive(readability.get(key)):
            fail.append(f'{key} must be positive')
    if fail:return fail
    hook=cfg.get('hook_contract')
    if hook is None:
        hook={}
        check_hook=False
    else:
        check_hook=True
    deadline=hook.get('deadline_seconds')
    complete=hook.get('planned_complete_by')
    if check_hook and (not positive(deadline) or not positive(complete) or complete>deadline):
        fail.append('Hook completion must be planned within deadline')
    if check_hook and (not hook.get('text') or not hook.get('beats')):
        fail.append('Hook needs text and beats')
    for beat in hook.get('beats',[]):
        end=beat.get('complete_by');start=beat.get('start')
        if not positive(end) or not isinstance(start,(int,float)) or not math.isfinite(start) or start<0 or start>=end or (positive(complete) and end>complete):
            fail.append('Invalid hook beat timing')
        font=beat.get('font_px')
        if not positive(font) or font*scale<readability['hook_min_display_px']:
            fail.append('Hook font below display budget')
    for shot in cfg.get('shots',[]):
        for item in shot.get('critical_text',[]):
            font=item.get('font_px')
            if not positive(font) or font*scale<readability['critical_min_display_px']:
                fail.append(f'{shot.get("id")}: critical font below display budget')
            if not positive(item.get('stable_hold_seconds')):
                fail.append(f'{shot.get("id")}: critical text needs a stable reading hold')
    ids=set()
    for shot in cfg.get('shots',[]):
        for beat in shot.get('text_beats',[]):
            name=beat.get('id')
            if not name or name in ids:
                fail.append('Missing/duplicate text beat id')
            ids.add(name)
            text=beat.get('text')
            if not isinstance(text,str) or not text:
                fail.append(f'{name}: text is empty')
                continue
            start,end=beat.get('start'),beat.get('end')
            if not isinstance(start,(int,float)) or not math.isfinite(start) or start<0 or not positive(end) or end<=start:
                fail.append(f'{name}: invalid entry/exit window')
                continue
            entry=beat.get('entry',{});exit=beat.get('exit',{})
            dur=entry.get('duration',.45);stagger=entry.get('stagger',.025)
            outdur=exit.get('duration',.35);outstep=exit.get('stagger',.012)
            if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (dur,stagger,outdur,outstep)) or min(dur,outdur)<=0 or min(stagger,outstep)<0:
                fail.append(f'{name}: invalid motion durations')
                continue
            complete=start+max(0,len(text)-1)*stagger+dur
            outstart=exit.get('start',end-outdur-max(0,len(text)-1)*outstep)
            if not isinstance(outstart,(int,float)) or not math.isfinite(outstart) or outstart<complete or outstart+max(0,len(text)-1)*outstep+outdur>end+1e-6:
                fail.append(f'{name}: exit overlaps entry or extends beyond end')
            font=beat.get('font_px')
            critical=beat.get('critical',beat.get('role') in ('narration','emphasis','quote'))
            if not positive(font) or (critical and font*scale<readability['critical_min_display_px']):
                fail.append(f'{name}: rendered text font below display budget')
            for highlight in beat.get('highlights',[]):
                if not highlight.get('text') or highlight['text'] not in text:
                    fail.append(f'{name}: highlight substring absent')
    return fail


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--shots',required=True)
    a=p.parse_args()
    failures=check(json.loads(Path(a.shots).read_text()))
    print(json.dumps({'scope':'planned budgets only; measure final MP4 separately','failures':failures},ensure_ascii=False,indent=2))
    return int(bool(failures))


if __name__=='__main__':
    raise SystemExit(main())
