import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import SleepAudioSynth from './audioSynth';

// Comforting sleep messages that rotate during blackout
const SLEEP_MESSAGES = [
  "눈을 부드럽게 감고, 깊은 호흡을 계속하세요.",
  "오늘 하루 정말 수고 많았습니다. 이제 다 내려놓으세요.",
  "들려오는 부드러운 소리에 마인드를 실어 보내세요.",
  "당신의 몸과 마음은 서서히 깊은 휴식 속으로 빠져듭니다.",
  "내일 걱정은 내일의 나에게 맡기고, 지금은 평온을 취하세요."
];

function App() {
  // Navigation & States
  const [screen, setScreen] = useState('dashboard'); // 'dashboard' | 'step1' | 'step2' | 'step3' | 'blackout' | 'morning'
  const [soundType, setSoundType] = useState('binaural'); // 'binaural' | 'ambient' | 'rain'
  const [timerDuration, setTimerDuration] = useState(15); // minutes (1 to 120)
  const [streak, setStreak] = useState(5);
  const [totalMinutes, setTotalMinutes] = useState(120);
  const [sleepSatisfaction, setSleepSatisfaction] = useState(null);
  
  // Ritual Step 1: Device Charge
  const [isChargerConnected, setIsChargerConnected] = useState(false);
  const [orientationSimulation, setOrientationSimulation] = useState(false); // Simulate face down for testing

  // Ritual Step 2: 4-7-8 Breathing
  const [breathPhase, setBreathPhase] = useState('ready'); // 'ready' | 'inhale' | 'hold' | 'exhale' | 'done'
  const [breathTimer, setBreathTimer] = useState(0);
  const [breathCycle, setBreathCycle] = useState(1);
  const breathIntervalRef = useRef(null);

  // Ritual Step 3: Brain Dump
  const [worryText, setWorryText] = useState('');
  const [isBurning, setIsBurning] = useState(false);

  // Blackout (Sleep Mode) Screen
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isVolumeVisible, setIsVolumeVisible] = useState(false);
  const [currentMessageIdx, setCurrentMessageIdx] = useState(0);
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [interactionWarning, setInteractionWarning] = useState(false);
  
  // Audio reference
  const audioSynth = useRef(new SleepAudioSynth());
  const volumeTimeoutRef = useRef(null);
  const touchStartY = useRef(0);

  // Radial dial drag states & refs
  const dialRef = useRef(null);
  const [isDialDragging, setIsDialDragging] = useState(false);

  const handleDialMove = (clientX, clientY) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    
    // Map angle to 1 - 120 minutes
    const pct = angle / (2 * Math.PI);
    const minutes = Math.round(pct * 119) + 1;
    setTimerDuration(Math.max(1, Math.min(120, minutes)));
  };

  const handleDialMouseDown = (e) => {
    setIsDialDragging(true);
    handleDialMove(e.clientX, e.clientY);
  };

  const handleDialTouchStart = (e) => {
    setIsDialDragging(true);
    handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDialDragging) {
        handleDialMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalTouchMove = (e) => {
      if (isDialDragging) {
        handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDialDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('touchmove', handleGlobalTouchMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDialDragging]);

  // Read initial stats from localStorage
  useEffect(() => {
    const storedStreak = localStorage.getItem('sleep_rit_streak');
    const storedMinutes = localStorage.getItem('sleep_rit_minutes');
    if (storedStreak) setStreak(parseInt(storedStreak, 10));
    if (storedMinutes) setTotalMinutes(parseInt(storedMinutes, 10));
  }, []);

  // Handle device orientation API (if mobile supports it)
  useEffect(() => {
    const handleOrientation = (e) => {
      // Check if device is flat face-down (beta close to 180 or -180, gamma close to 0)
      const beta = e.beta;
      const gamma = e.gamma;
      
      if (beta && (Math.abs(beta) > 165 || Math.abs(beta) < 15) && screen === 'step1') {
        // Detected laying down flat
        if (isChargerConnected) {
          // Trigger transition if charger is connected
          handleNextFromStep1();
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [screen, isChargerConnected]);

  // Breathing Guide Loop (4-7-8 Method)
  useEffect(() => {
    if (screen !== 'step2') {
      clearInterval(breathIntervalRef.current);
      setBreathPhase('ready');
      setBreathCycle(1);
      return;
    }

    if (breathPhase === 'ready') return;

    // Handle breath timer decrement
    breathIntervalRef.current = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          clearInterval(breathIntervalRef.current);
          // Transition to next breathing phase
          transitionBreathingPhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(breathIntervalRef.current);
  }, [screen, breathPhase, breathCycle]);

  // Helper to transition between inhale, hold, exhale phases
  const transitionBreathingPhase = () => {
    if (breathPhase === 'inhale') {
      setBreathPhase('hold');
      setBreathTimer(7);
      triggerHaptic(100); // feedback
    } else if (breathPhase === 'hold') {
      setBreathPhase('exhale');
      setBreathTimer(8);
      triggerHaptic(200); // feedback
    } else if (breathPhase === 'exhale') {
      if (breathCycle >= 3) {
        setBreathPhase('done');
        setBreathTimer(0);
      } else {
        setBreathCycle(c => c + 1);
        setBreathPhase('inhale');
        setBreathTimer(4);
        triggerHaptic(50);
      }
    }
  };

  const startBreathing = () => {
    setBreathPhase('inhale');
    setBreathTimer(4);
    setBreathCycle(1);
  };

  // Blackout timer & message rotation
  useEffect(() => {
    let countdownInterval;
    let messageInterval;

    if (screen === 'blackout') {
      // Initialize audio
      audioSynth.current.setVolume(volume);
      audioSynth.current.start(soundType);

      // Start countdown
      setSecondsRemaining(timerDuration * 60);

      countdownInterval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            finishSleepRitual();
            return 0;
          }
          
          // Trigger fade-out 15 seconds before the end
          if (prev === 16) {
            audioSynth.current.fadeAndStop(15);
          }

          return prev - 1;
        });
      }, 1000);

      // Rotate sleep messages
      setIsMessageVisible(true);
      messageInterval = setInterval(() => {
        setIsMessageVisible(false);
        setTimeout(() => {
          setCurrentMessageIdx((prev) => (prev + 1) % SLEEP_MESSAGES.length);
          setIsMessageVisible(true);
        }, 800); // fade duration offset
      }, 8000);
    } else {
      audioSynth.current.stop();
    }

    return () => {
      clearInterval(countdownInterval);
      clearInterval(messageInterval);
    };
  }, [screen]);

  // Vibrate device if API is supported (haptic feedback)
  const triggerHaptic = (ms) => {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  // Action: Charge completes or simulated flip flat
  const handleNextFromStep1 = () => {
    triggerHaptic(150);
    setScreen('step2');
  };

  // Action: Finish breathing
  const handleNextFromStep2 = () => {
    triggerHaptic(100);
    setScreen('step3');
  };

  // Action: Dissolve worries and start sleep blackout
  const handleBurnWorries = () => {
    if (!worryText.trim()) return;
    setIsBurning(true);
    triggerHaptic([100, 50, 100]); // continuous crackling vibration
    
    // Switch to blackout after dissolution animation completes (2.5s)
    setTimeout(() => {
      setIsBurning(false);
      setWorryText('');
      setScreen('blackout');
    }, 2500);
  };

  // Action: Blackout completes naturally
  const finishSleepRitual = () => {
    triggerHaptic([300, 100, 300]);
    // Save new statistics
    const newStreak = streak + 1;
    const newTotalMinutes = totalMinutes + timerDuration;
    
    setStreak(newStreak);
    setTotalMinutes(newTotalMinutes);
    localStorage.setItem('sleep_rit_streak', newStreak.toString());
    localStorage.setItem('sleep_rit_minutes', newTotalMinutes.toString());
    
    setScreen('morning');
  };

  // Action: User interrupts sleep mode early
  const handleInterruptSleep = () => {
    audioSynth.current.stop();
    setScreen('dashboard');
  };

  // Volume slider controls on blackout screen
  const showVolumeSlider = (newVol) => {
    const boundedVol = Math.max(0, Math.min(1, newVol));
    setVolume(boundedVol);
    audioSynth.current.setVolume(boundedVol);
    setIsVolumeVisible(true);

    clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => {
      setIsVolumeVisible(false);
    }, 2000);
  };

  const handleBlackoutScroll = (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    // Scroll up raises volume, scroll down lowers volume
    const volChange = delta < 0 ? 0.05 : -0.05;
    showVolumeSlider(volume + volChange);
  };

  const handleBlackoutTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleBlackoutTouchMove = (e) => {
    const currentY = e.touches[0].clientY;
    const diffY = touchStartY.current - currentY; // upward is positive
    const volChange = diffY > 0 ? 0.01 : -0.01;
    showVolumeSlider(volume + volChange);
  };

  const handleBlackoutTap = () => {
    // Show soft warning when they tap the black screen, to discourage checking phone
    setInteractionWarning(true);
    setTimeout(() => {
      setInteractionWarning(false);
    }, 3000);
  };

  // Format countdown remaining seconds
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="phone-frame">
      <div className="app-viewport">
        
        {/* DASHBOARD SCREEN */}
        {screen === 'dashboard' && (
          <div className="fade-enter-active">
            <div className="app-header">
              <h1>SleepRit</h1>
              <div className="streak-badge">
                🔥 <span>{streak}일 연속</span>
              </div>
            </div>

            <p style={{ marginBottom: '24px', textAlign: 'left' }}>
              오늘 밤, 스마트폰 도파민 중독을 끊고 나를 위한 아늑한 취침 의식을 시작하세요.
            </p>

            <div className="dashboard-stats">
              <div className="stat-item">
                <div className="stat-val">{totalMinutes}분</div>
                <div className="stat-label">총 디톡스 시간</div>
              </div>
              <div className="stat-item">
                <div className="stat-val">어젯밤 수면</div>
                <div className="stat-label">
                  {sleepSatisfaction === 'good' && '좋음 😴'}
                  {sleepSatisfaction === 'meh' && '보통 😐'}
                  {sleepSatisfaction === 'bad' && '피곤 😊'}
                  {!sleepSatisfaction && '기록 없음'}
                </div>
              </div>
            </div>

            {/* Step 0.1: Sleep satisfaction check-in */}
            <div className="glass-card">
              <h2>오늘 아침 컨디션은 어땠나요?</h2>
              <p style={{ marginBottom: '12px' }}>매일 아침 수면 평가를 기록해 습관을 교정하세요.</p>
              <div className="sleep-feedback">
                <span 
                  className={`feedback-emoji ${sleepSatisfaction === 'bad' ? 'selected' : ''}`}
                  onClick={() => setSleepSatisfaction('bad')}
                  title="피곤함"
                >
                  😊
                </span>
                <span 
                  className={`feedback-emoji ${sleepSatisfaction === 'meh' ? 'selected' : ''}`}
                  onClick={() => setSleepSatisfaction('meh')}
                  title="보통"
                >
                  😐
                </span>
                <span 
                  className={`feedback-emoji ${sleepSatisfaction === 'good' ? 'selected' : ''}`}
                  onClick={() => setSleepSatisfaction('good')}
                  title="개운함"
                >
                  😴
                </span>
              </div>
            </div>

            {/* Set Audio & Timer settings */}
            <div className="glass-card">
              <h2>수면 의식 설정</h2>
              
              <div className="radial-dial-container">
                <div 
                  ref={dialRef}
                  className="dial-wrapper"
                  onMouseDown={handleDialMouseDown}
                  onTouchStart={handleDialTouchStart}
                >
                  <svg className="dial-svg" viewBox="0 0 180 180">
                    <defs>
                      <linearGradient id="dial-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--accent)" />
                        <stop offset="100%" stopColor="var(--accent-dim)" />
                      </linearGradient>
                    </defs>
                    
                    {/* Background Track */}
                    <circle className="dial-bg" cx="90" cy="90" r="75" />
                    
                    {/* Active Progress Arc */}
                    <circle 
                      className="dial-progress" 
                      cx="90" 
                      cy="90" 
                      r="75" 
                      strokeDasharray="471.24"
                      strokeDashoffset={471.24 * (1 - (timerDuration - 1) / 119)}
                    />
                    
                    {/* Rotating Handle */}
                    <circle 
                      className="dial-handle" 
                      cx={90 + 75 * Math.cos(((timerDuration - 1) / 119) * 2 * Math.PI - Math.PI / 2)} 
                      cy={90 + 75 * Math.sin(((timerDuration - 1) / 119) * 2 * Math.PI - Math.PI / 2)} 
                      r="10" 
                    />
                  </svg>
                  
                  {/* Center time reading */}
                  <div className="dial-center-info">
                    <span className="minutes">{timerDuration}</span>
                    <span className="unit">분</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="presets-container">
                  {[15, 30, 60, 90].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`preset-btn ${timerDuration === preset ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTimerDuration(preset);
                        triggerHaptic(50);
                      }}
                    >
                      {preset}분
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', textAlign: 'left', marginBottom: '6px' }}>
                  수면 사운드 유형
                </span>
                <div className="sound-selector">
                  <div 
                    className={`sound-pill ${soundType === 'binaural' ? 'active' : ''}`}
                    onClick={() => setSoundType('binaural')}
                  >
                    델타 바이노럴
                  </div>
                  <div 
                    className={`sound-pill ${soundType === 'ambient' ? 'active' : ''}`}
                    onClick={() => setSoundType('ambient')}
                  >
                    명상 패드
                  </div>
                  <div 
                    className={`sound-pill ${soundType === 'rain' ? 'active' : ''}`}
                    onClick={() => setSoundType('rain')}
                  >
                    자연의 비
                  </div>
                </div>
              </div>
            </div>

            <button 
              className="btn-primary" 
              style={{ marginTop: '16px' }}
              onClick={() => setScreen('step1')}
            >
              수면 의식 시작하기 🌙
            </button>
          </div>
        )}

        {/* STEP 1: CHARGE & ISOLATE */}
        {screen === 'step1' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>
            
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 1단계
              </div>
              <h2 style={{ fontSize: '24px', lineHeight: '1.3' }}>기기 격리 및 전원 연결</h2>
              <p style={{ marginTop: '16px', fontSize: '15px' }}>
                스마트폰 충전기를 꽂고 침대에서 최소 2m 이상 떨어진 무드등 테이블 위에 놓아주세요.
              </p>
            </div>

            <div className="glass-card" style={{ margin: '40px 0', padding: '24px', textAlign: 'left' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
                <input 
                  type="checkbox" 
                  checked={isChargerConnected}
                  onChange={(e) => setIsChargerConnected(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '15px', fontWeight: '600' }}>충전 케이블을 연결했습니다.</span>
              </label>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                기기가 전원에 연결되고 평평한 바닥에 엎어 놓였을 때(센서 인식 시) 다음 단계로 즉시 넘어갈 수 있습니다.
              </p>
            </div>

            {/* Laptop/Desktop simulation card for Testing */}
            <div className="glass-card" style={{ borderStyle: 'dashed', borderColor: 'var(--accent)' }}>
              <h3 style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '4px' }}>💻 데스크탑 시뮬레이터</h3>
              <p style={{ fontSize: '11px', marginBottom: '12px' }}>
                기기 센서를 모방하는 테스트용 가상 토글입니다.
              </p>
              <button 
                className="btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => {
                  setIsChargerConnected(true);
                  handleNextFromStep1();
                }}
              >
                폰 엎어놓기 시뮬레이션 실행 (Flat Down)
              </button>
            </div>

            <button 
              className="btn-primary"
              disabled={!isChargerConnected}
              style={{ opacity: isChargerConnected ? 1 : 0.4, cursor: isChargerConnected ? 'pointer' : 'not-allowed' }}
              onClick={handleNextFromStep1}
            >
              연결 완료
            </button>
          </div>
        )}

        {/* STEP 2: 4-7-8 BREATHING */}
        {screen === 'step2' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 2단계
              </div>
              <h2 style={{ fontSize: '24px' }}>4-7-8 이완 호흡</h2>
              <p style={{ marginTop: '8px' }}>심박수를 늦추고 자극된 부교감신경을 자극하여 뇌를 진정시키는 호흡법입니다.</p>
            </div>

            <div>
              {breathPhase === 'ready' ? (
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                  <button className="btn-secondary" style={{ width: 'auto', padding: '16px 32px' }} onClick={startBreathing}>
                    호흡 시작하기
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div className="breathing-circle-outer">
                    <div className={`breathing-circle ${breathPhase}`}>
                      {breathTimer}s
                    </div>
                  </div>
                  <div style={{ height: '50px' }}>
                    <h3 style={{ color: 'var(--accent)', fontSize: '18px' }}>
                      {breathPhase === 'inhale' && '코로 숨을 깊게 들이쉬세요'}
                      {breathPhase === 'hold' && '호흡을 멈추세요'}
                      {breathPhase === 'exhale' && '입으로 천천히 내쉬세요'}
                      {breathPhase === 'done' && '호흡 완료'}
                    </h3>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>
                      {breathPhase !== 'done' && `총 3회 중 ${breathCycle}번째 사이클`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button 
              className="btn-primary"
              onClick={handleNextFromStep2}
              style={{ marginTop: '20px' }}
            >
              {breathPhase === 'done' ? '호흡 완료 (다음 단계)' : '건너뛰고 다음 단계'}
            </button>
          </div>
        )}

        {/* STEP 3: BRAIN DUMP */}
        {screen === 'step3' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 3단계
              </div>
              <h2 style={{ fontSize: '24px' }}>걱정 휴지통 (브레인 덤프)</h2>
              <p style={{ marginTop: '8px' }}>오늘 하루 머릿속에 가득했던 잡념, 할 일, 혹은 스트레스 원인을 텍스트로 자유롭게 털어내세요.</p>
            </div>

            <div style={{ margin: '24px 0' }}>
              <textarea
                className={`worry-textarea ${isBurning ? 'burning' : ''}`}
                value={worryText}
                onChange={(e) => setWorryText(e.target.value)}
                placeholder="여기에 적어 내려가세요. 이 걱정은 저장이 아닌 '영구 삭제' 됩니다."
                disabled={isBurning}
              />
            </div>

            <button 
              className="btn-primary"
              onClick={handleBurnWorries}
              disabled={!worryText.trim() || isBurning}
              style={{ opacity: worryText.trim() && !isBurning ? 1 : 0.4 }}
            >
              {isBurning ? '걱정 태워버리는 중...' : '걱정 지우고 잠들기 💫'}
            </button>
          </div>
        )}

        {/* BLACKOUT SCREEN (SLEEP LOCKED) */}
        {screen === 'blackout' && (
          <div 
            className="blackout-screen"
            onWheel={handleBlackoutScroll}
            onTouchStart={handleBlackoutTouchStart}
            onTouchMove={handleBlackoutTouchMove}
            onClick={handleBlackoutTap}
          >
            {/* Tiny Exit cross in the corner - almost invisible, avoids tempting users */}
            <button 
              className="exit-ritual" 
              onClick={handleInterruptSleep}
              style={{ top: '15px', right: '15px', color: '#1e293b', fontSize: '16px' }}
            >
              ✕ 중단
            </button>

            {/* Countdown timer - very dim */}
            <div style={{ color: '#0f172a', fontSize: '12px', position: 'absolute', top: '24px', letterSpacing: '2px' }}>
              TIMER {formatTime(secondsRemaining)}
            </div>

            {/* Fading text guidance */}
            <div 
              className={`sleep-guidance-text ${isMessageVisible ? 'visible' : ''}`}
              style={{ color: '#475569', transition: 'opacity 1s ease-in-out' }}
            >
              {SLEEP_MESSAGES[currentMessageIdx]}
            </div>

            {/* Soft reminder warning if screen is tapped */}
            <div 
              className={`sleep-guidance-text ${interactionWarning ? 'visible' : ''}`}
              style={{ 
                position: 'absolute', 
                color: 'var(--accent-dim)', 
                fontSize: '12px', 
                fontWeight: '600', 
                bottom: '140px',
                transition: 'opacity 0.3s ease'
              }}
            >
              화면을 만지지 않고 눈을 감는 편이 좋습니다... 🕯️
            </div>

            {/* Temporary Volume overlay indicator */}
            <div className={`volume-indicator ${isVolumeVisible ? 'visible' : ''}`}>
              <span>소리 크기</span>
              <div className="volume-bar">
                <div 
                  className="volume-bar-fill" 
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
              <span>{Math.round(volume * 100)}%</span>
            </div>

            {/* Interaction guide */}
            <div style={{ position: 'absolute', bottom: '32px', color: '#1e293b', fontSize: '10px', pointerEvents: 'none' }}>
              쓸어올리거나 내리면 음량이 조절됩니다.
            </div>
          </div>
        )}

        {/* MORNING / RITUAL COMPLETE SCREEN */}
        {screen === 'morning' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', textAlign: 'center' }}>
            
            <div style={{ marginTop: '40px' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🌙 ➔ 🌅</span>
              <h2 style={{ fontSize: '26px', color: 'var(--accent)' }}>수면 의식 완료</h2>
              <p style={{ marginTop: '16px', fontSize: '15px' }}>
                스마트폰의 스크롤 유혹을 참아내고 수면 상태 진입에 성공하셨습니다.
              </p>
            </div>

            <div className="glass-card" style={{ margin: '30px 0', padding: '24px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>수고한 나를 위한 기록</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0', color: 'var(--text-main)' }}>
                🔥 {streak}일 연속
              </div>
              <p style={{ fontSize: '13px' }}>
                당신은 오늘 밤 총 <strong>{timerDuration}분</strong>의 도파민 스마트폰 오프시간을 사수했습니다.
              </p>
            </div>

            <button 
              className="btn-primary"
              onClick={() => setScreen('dashboard')}
            >
              대시보드로 돌아가기
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
