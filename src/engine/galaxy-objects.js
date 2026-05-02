import { G, SOFT_BH, SOFT_TIDAL, GALAXY_TYPES } from './constants.js';
import { rand, gauss } from './utils.js';

const SOFT_STAR = 1.5;
const V_MAX     = 22;
const V_MAX2    = V_MAX * V_MAX;
// Facteur d'amortissement orbital très léger pour stabiliser sans tuer les orbites
const ORBIT_DAMP = 0.9998;

// ─── Star ─────────────────────────────────────────────────────────────────────
class Star {
    constructor(lx,ly,lz,lvx,lvy,lvz) {
        this.lx=lx; this.ly=ly; this.lz=lz;
        this.lvx=lvx; this.lvy=lvy; this.lvz=lvz;
        this.lax=0; this.lay=0; this.laz=0;
        this.lax0=0; this.lay0=0; this.laz0=0;
        this.alive=true; this.glow=0;
    }
}

// ─── BlackHole ────────────────────────────────────────────────────────────────
class BlackHole {
    static _id=0;
    constructor(x,y,z,mass) {
        this.id=BlackHole._id++; this.x=x; this.y=y; this.z=z;
        this.mass=mass; this.alive=true; this.trail=[]; this.trailMax=150; this.mergedFlash=0;
    }
    get rh(){ return Math.pow(G*this.mass*0.01,1/3); }
    get ra(){ return this.rh*25; }
}

// ─── Galaxy ───────────────────────────────────────────────────────────────────
class Galaxy {
    static _id=0;

    constructor(x,y,z,vx,vy,vz,type,preset) {
        this.id=Galaxy._id++;
        this.x=x; this.y=y; this.z=z;
        this.vx=vx; this.vy=vy; this.vz=vz;
        this.ax=0; this.ay=0; this.az=0;
        this.ax0=0; this.ay0=0; this.az0=0;
        this.type=type; this.preset=preset;
        this.alive=true; this.stars=[]; this.bh=null; this._merging=false;
        this._setupOrientation();
        this._initMasses(preset);
        this._initShape(type);
        this.bh=new BlackHole(x,y,z,this.Mbh);
        this._generate();
        this.gasFraction=this._initGasFraction(type);
        this.morphologyTransition={active:false,t:0,duration:5.0};
        this.starFormationCooldown=0;
    }

    get blackHole(){ return this.bh; }
    get mass()     { return this.Mtot; }

    _initGasFraction(type) {
        return {spiral:0.30,barred:0.25,irregular:0.40,lenticular:0.10,elliptical:0.05}[type]??0.20;
    }

    _setupOrientation() {
        const theta=Math.random()*Math.PI*2;
        const phi=Math.acos(2*Math.random()-1);
        this.ox=Math.sin(phi)*Math.cos(theta);
        this.oy=Math.sin(phi)*Math.sin(theta);
        this.oz=Math.cos(phi);
        const len=Math.sqrt(1-this.oz*this.oz)||1;
        this.ux=-this.oy/len; this.uy=this.ox/len; this.uz=0;
        this._wx=this.oy*this.uz-this.oz*this.uy;
        this._wy=this.oz*this.ux-this.ox*this.uz;
        this._wz=this.ox*this.uy-this.oy*this.ux;
    }

    _localToWorld(lx,ly,lz) {
        return [lx*this.ux+ly*this._wx+lz*this.ox+this.x,
                lx*this.uy+ly*this._wy+lz*this.oy+this.y,
                lx*this.uz+ly*this._wz+lz*this.oz+this.z];
    }
    _worldToLocal(wx,wy,wz) {
        const dx=wx-this.x,dy=wy-this.y,dz=wz-this.z;
        return [dx*this.ux+dy*this.uy+dz*this.uz,
                dx*this._wx+dy*this._wy+dz*this._wz,
                dx*this.ox+dy*this.oy+dz*this.oz];
    }
    _localToWorldVel(lx,ly,lz) {
        return [lx*this.ux+ly*this._wx+lz*this.ox,
                lx*this.uy+ly*this._wy+lz*this.oy,
                lx*this.uz+ly*this._wz+lz*this.oz];
    }
    _worldToLocalVel(wx,wy,wz) {
        return [wx*this.ux+wy*this.uy+wz*this.uz,
                wx*this._wx+wy*this._wy+wz*this._wz,
                wx*this.ox+wy*this.oy+wz*this.oz];
    }

    _initMasses(preset) {
        this.Mtot=preset.M*rand(0.9,1.1);
        this.Rd=preset.Rd; this.Zh=preset.Zh; this.Rb=preset.Rb; this.Rh=preset.Rh;
        this.Mbh=this.Mtot*preset.bhR;
        this.Mbulge=this.Mtot*0.10;
        this.Mdisk =this.Mtot*0.15;
        this.Mhalo =this.Mtot*0.60;
        if (this.type==='elliptical'){this.Mbulge=this.Mtot*0.35;this.Mdisk=this.Mtot*0.02;this.Mhalo=this.Mtot*0.50;}
        if (this.type==='lenticular'){this.Mbulge=this.Mtot*0.20;this.Mdisk=this.Mtot*0.15;this.Mhalo=this.Mtot*0.55;}
    }

    _initShape(type) {
        const info=GALAXY_TYPES[type];
        if (info?.armRange){this.nArms=Math.floor(rand(...info.armRange));this.pitch=rand(...info.pitchRange);this.armW=rand(0.25,0.45);}
        if (type==='barred'){this.nArms=2;this.pitch=rand(0.2,0.35);this.armW=0.3;this.barLen=this.Rd*rand(0.5,0.8);this.barAngle=Math.random()*Math.PI;}
        if (type==='irregular'){this.nArms=Math.floor(rand(...info.armRange));this.pitch=rand(...info.pitchRange);this.armW=0.6;}
    }

    // ── Courbe de rotation plate (disque + bulbe + halo matière noire) ────────
    _vc(R) {
        const eps2=SOFT_STAR*SOFT_STAR;
        const R2=R*R+eps2;
        const fBH   =G*this.Mbh/R2;
        const fBulge=G*this.Mbulge*R*R/Math.pow(R2+this.Rb*this.Rb,1.5);
        const xd=R/(this.Rd+0.001);
        const mDE=this.Mdisk*(1-(1+xd)*Math.exp(-xd));
        const fDisk =G*mDE/R2;
        const v200sq=G*this.Mhalo/(this.Rh+0.001);
        const fHalo =v200sq*R*R/(R2+this.Rh*this.Rh);
        return Math.sqrt(Math.max(fBH+fBulge+fDisk+fHalo,1e-6));
    }

    _generate() {
        const N=Math.floor(this.preset.N*rand(0.85,1.15));
        for (let i=0;i<N;i++) {
            let lx,ly,lz,lvx,lvy,lvz;
            if (this.type==='elliptical') {
                const Re=this.Rb*2.5;
                let R=Re*-Math.log(1-Math.random()*0.98); if(R>Re*6)R=Re*6;
                const t2=Math.random()*Math.PI*2,p2=Math.acos(2*Math.random()-1),f=0.55+Math.random()*0.15;
                lx=R*Math.sin(p2)*Math.cos(t2); ly=R*Math.sin(p2)*Math.sin(t2); lz=R*Math.cos(p2)*f;
                const sig=Math.sqrt(G*(this.Mbh+this.Mbulge)/(R+SOFT_STAR))*0.28;
                lvx=gauss(0,sig); lvy=gauss(0,sig); lvz=gauss(0,sig)*0.5;
            } else {
                let R=this.Rd*-Math.log(1-Math.random()*0.98); if(R>this.Rd*5)R=this.Rd*5;
                let theta;
                if (this.type==='barred'&&Math.random()>0.4&&R<this.barLen) {
                    R=Math.random()*this.barLen; theta=this.barAngle+(Math.random()-0.5)*0.5;
                } else if (this.nArms) {
                    const arm=Math.floor(Math.random()*this.nArms);
                    theta=arm*(2*Math.PI/this.nArms)+Math.log(Math.max(R,0.1))/Math.tan(this.pitch)+(Math.random()-0.5)*this.armW*2;
                } else {
                    theta=Math.random()*Math.PI*2;
                }
                lx=R*Math.cos(theta); ly=R*Math.sin(theta); lz=gauss(0,this.Zh*0.5)*(1+R*0.008);
                const vc=this._vc(R),e=0.95+Math.random()*0.06,vr=gauss(0,vc*0.02);
                lvx=-vc*Math.sin(theta)*e+vr*Math.cos(theta);
                lvy= vc*Math.cos(theta)*e+vr*Math.sin(theta);
                lvz=gauss(0,vc*0.006);
            }
            this.stars.push(new Star(lx,ly,lz,lvx,lvy,lvz));
        }
    }

    // ── Accélérations locales ─────────────────────────────────────────────────
    /**
     * Correction référentiel non-inertiel :
     * Le centre galactique est accéléré. Pour les étoiles dans ce référentiel,
     * il faut soustraire l'accélération du centre (force fictive d'entraînement).
     *
     * IMPORTANT : on applique cette correction UNIQUEMENT si l'accélération du centre
     * est petite (|a| < seuil). Pendant la phase de merge, les centres peuvent avoir
     * de très grandes accélérations artificielles dues au drag → on ignore la correction
     * dans ce cas pour ne pas expulser les étoiles.
     */
    computeAccelerations(allBHs, otherGalaxies, enableTides) {
        const bh=this.bh;
        // Magnitude de l'accélération du centre
        const aCenMag2=this.ax*this.ax+this.ay*this.ay+this.az*this.az;
        // Seuil : si |a_centre| > 0.5, ne pas appliquer correction (merge en cours)
        const applyFictitious = !this._merging && aCenMag2<0.25;
        // Projection de l'accélération du centre en local (force fictive)
        let fixAx=0,fixAy=0,fixAz=0;
        if (applyFictitious) {
            [fixAx,fixAy,fixAz]=this._worldToLocalVel(this.ax,this.ay,this.az);
        }

        for (const star of this.stars) {
            if (!star.alive) continue;
            star.lax0=star.lax; star.lay0=star.lay; star.laz0=star.laz;

            const lx=star.lx,ly=star.ly,lz=star.lz;
            const R2=lx*lx+ly*ly+lz*lz+SOFT_STAR*SOFT_STAR;
            const R=Math.sqrt(R2);
            const invR3=1/(R2*R);

            // Force locale (BH + bulbe + halo + disque)
            const fBH   =G*bh.mass*invR3;
            const fBulge=G*this.Mbulge/Math.pow(R2+this.Rb*this.Rb,1.5);
            const v200sq=G*this.Mhalo/(this.Rh+0.001);
            const fHalo =v200sq/(R2+this.Rh*this.Rh);
            const xd=R/(this.Rd+0.001);
            const mDE=this.Mdisk*(1-(1+xd)*Math.exp(-xd));
            const fDisk=G*mDE*invR3;

            let ax=-(fBH+fBulge+fHalo+fDisk)*lx;
            let ay=-(fBH+fBulge+fHalo+fDisk)*ly;
            let az=-(fBH+fBulge+fHalo+fDisk)*lz;

            // Marées (force de marée pure = force directe − force sur le centre)
            if (enableTides && !this._merging) {
                const [sx,sy,sz]=this._localToWorld(lx,ly,lz);
                for (const other of otherGalaxies) {
                    if (other===this||!other.alive) continue;
                    const dx=other.x-sx,dy=other.y-sy,dz=other.z-sz;
                    const d2=dx*dx+dy*dy+dz*dz+SOFT_TIDAL*SOFT_TIDAL,d=Math.sqrt(d2);
                    const ft=G*other.Mtot/(d2*d);
                    // Force directe sur l'étoile
                    const fwx=ft*dx,fwy=ft*dy,fwz=ft*dz;
                    // Force sur le centre galactique (approx)
                    const dx0=other.x-this.x,dy0=other.y-this.y,dz0=other.z-this.z;
                    const d02=dx0*dx0+dy0*dy0+dz0*dz0+SOFT_TIDAL*SOFT_TIDAL,d0=Math.sqrt(d02);
                    const ft0=G*other.Mtot/(d02*d0);
                    // Force de marée = différence (en monde), projetée en local
                    const [tlx,tly,tlz]=this._worldToLocalVel(fwx-ft0*dx0,fwy-ft0*dy0,fwz-ft0*dz0);
                    ax+=tlx; ay+=tly; az+=tlz;
                }
            }

            // Correction référentiel accéléré (seulement si centre peu accéléré)
            ax-=fixAx; ay-=fixAy; az-=fixAz;

            star.lax=ax; star.lay=ay; star.laz=az;
            star.glow=R<bh.ra?1-R/bh.ra:0;
        }
    }

    // ── Intégration Velocity-Verlet ───────────────────────────────────────────
    integrate(dt) {
        for (const star of this.stars) {
            if (!star.alive) continue;
            // Position Verlet
            star.lx+=star.lvx*dt+0.5*star.lax0*dt*dt;
            star.ly+=star.lvy*dt+0.5*star.lay0*dt*dt;
            star.lz+=star.lvz*dt+0.5*star.laz0*dt*dt;
            // Vitesse Verlet
            star.lvx+=0.5*(star.lax0+star.lax)*dt;
            star.lvy+=0.5*(star.lay0+star.lay)*dt;
            star.lvz+=0.5*(star.laz0+star.laz)*dt;
            // Amortissement orbital très léger (stabilité)
            star.lvx*=ORBIT_DAMP; star.lvy*=ORBIT_DAMP; star.lvz*=ORBIT_DAMP;
            // Clamping vitesse
            const sp2=star.lvx*star.lvx+star.lvy*star.lvy+star.lvz*star.lvz;
            if (sp2>V_MAX2){const f=V_MAX/Math.sqrt(sp2);star.lvx*=f;star.lvy*=f;star.lvz*=f;}
        }
    }

    getWorldStars() {
        const out=[];
        for (const star of this.stars) {
            if (!star.alive) continue;
            const [wx,wy,wz]=this._localToWorld(star.lx,star.ly,star.lz);
            const dist=Math.sqrt(star.lx*star.lx+star.ly*star.ly+star.lz*star.lz);
            out.push({x:wx,y:wy,z:wz,glow:star.glow,distFromCenter:dist,galaxyType:this.type,
                vx:star.lvx,vy:star.lvy,vz:star.lvz,accretionGlow:star.glow});
        }
        return out;
    }
}

export { Star, BlackHole, Galaxy };