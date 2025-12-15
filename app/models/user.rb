# frozen_string_literal: true
require 'faker'

class User < ApplicationRecord
  VALID_EMAIL_REGEX = /\A([^@\s]{1,64})@((?:[-\p{L}\d]+\.)+\p{L}{2,})\z/i

  before_create :set_default_role

  devise :database_authenticatable, :registerable, :recoverable, :rememberable, :trackable, :validatable, :confirmable

  has_many :messages, dependent: :destroy
  has_many :rooms, through: :messages
  has_and_belongs_to_many :roles
  has_many :room_user_nicknames, dependent: :destroy
  has_many :moderatorships, dependent: :destroy
  has_many :muted_room_users, dependent: :destroy

  validates :username, presence: true, uniqueness: true, length: { minimum: 3, maximum: 64 }
  validates :email, presence: true, uniqueness: true, format: { with: VALID_EMAIL_REGEX }

  scope :not_anonymous, -> { includes(:roles).where.not(roles_users: { role_id: Role.anonymous.id.to_s })}

  def role?(role)
    roles.include?(role)
  end

  def nickname_in_room(room)
    return 'OP' if room.owner_id == id
    return ENV['VICTORIOUSBORN_NICKNAME'] if ENV['VICTORIOUSBORN_NICKNAME'].present? && username == 'victoriousBorn'

    nickname_record = room.room_user_nicknames.find { |room_user_nickname| room_user_nickname.user_id == id } if room.room_user_nicknames.loaded?
    nickname_record ||= room.room_user_nicknames.find_by(user_id: id)

    return nickname_record.nickname if nickname_record

    RoomUserNickname.transaction do
      room.room_user_nicknames.lock

      nickname_record = room.room_user_nicknames.find_by(user_id: id)
      return nickname_record.nickname if nickname_record

      existing_names = room.room_user_nicknames.pluck(:nickname)
      nickname = generate_nickname(existing_names)

      room.room_user_nicknames.create!(
        user: self,
        nickname: nickname,
        room: room
      ).nickname
    end
  end

  def muted_in_room?(room)
    @muted_in_room ||= {}
    @muted_in_room[room.id] ||= MutedRoomUser.exists?(room: room, user: self)
  end

  private

  def generate_nickname(existing_names)
    candidates = [
      Faker::Space.planet,
      Faker::Space.moon,
      Faker::Space.galaxy,
      Faker::Space.star,
      Faker::TvShows::Stargate.planet,
      Faker::Movies::StarWars.planet,
      Faker::Games::Witcher.location
    ].compact

    candidates.shuffle.each do |candidate|
      return candidate unless existing_names.include?(candidate)
    end

    loop do
      fallback = "Traveler-#{SecureRandom.hex(3)}"
      return fallback unless existing_names.include?(fallback)
    end
  end

  def set_default_role
    unless roles.include?(Role.anonymous)
      roles << Role.registered
    end
  end
end
