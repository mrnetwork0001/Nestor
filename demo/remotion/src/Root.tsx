import React from 'react'
import { Composition } from 'remotion'
import { Nestor, NESTOR_DURATION } from './Nestor'

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Nestor"
    component={Nestor}
    durationInFrames={NESTOR_DURATION}
    fps={30}
    width={1920}
    height={1080}
  />
)
